import { Router } from 'express'
import { createSession, requireStudent } from '../lib/auth.js'
import { fail, publicUser } from '../lib/helpers.js'
import { hoursFromNow, nowIso, sha256 } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const ageFrom = (birthDate) => {
  if (!birthDate) return null
  const b = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1
  return age
}

export function authRoutes() {
  const r = Router()

  r.post('/auth/login', (req, res) => {
    const { provider = 'email', email, password, device } = req.body || {}
    if (provider === 'email' && (!email || !password)) {
      return fail(res, 422, 'invalid_credentials', 'Informe e-mail e senha.')
    }
    const state = req.store.state
    const user = state.users.find((u) => u.id === 'u1')
    const session = createSession(state, { userId: user.id, role: 'student', device: device || 'Este aparelho · Navegador' })
    state.sessions.forEach((s) => (s.current = s.id === session.id))
    res.json({ token: session.token, sessionId: session.id, user: publicUser(state, user), provider })
  })

  r.post('/auth/register', (req, res) => {
    const state = req.store.state
    const { name, email, phone, birthDate, student, origin, device } = req.body || {}
    const errors = {}
    if (!name || name.trim().length < 2) errors.name = 'Escreva seu nome como quer ser chamado.'
    if (!/.+@.+\..+/.test(email || '')) errors.email = 'Digite um e-mail com @ para continuar.'
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) errors.phone = 'Digite DDD e número, com 10 ou 11 dígitos.'
    if (!birthDate) errors.birthDate = 'Informe sua data de nascimento.'
    if (student !== true && student !== false) errors.student = 'Escolha sim ou não.'
    if (Object.keys(errors).length) return fail(res, 422, 'validation', 'Confira os campos marcados.', { errors })

    const ip = req.ip || 'local'
    const bucket = (state.registrationsByIp[ip] = state.registrationsByIp[ip] || [])
    const since = Date.now() - 24 * 3600 * 1000
    const recent = bucket.filter((ts) => ts > since)
    if (recent.length >= 5 && !req.body.captchaToken) {
      return fail(res, 429, 'captcha_required', 'Muitas contas criadas neste dispositivo nas últimas 24 h. Complete o desafio para continuar.', { limit: 5 })
    }
    bucket.push(Date.now())

    const user = state.users.find((u) => u.id === 'u1')
    const age = ageFrom(birthDate)
    Object.assign(user, {
      name: name.trim(),
      email,
      phone,
      birthDate,
      origin: origin || null,
      isStudent: student,
      verified: { email: false, phone: false },
      ageVerification: { status: 'pendente', method: null, provider: 'Verificador homologado' },
      isMinor: age !== null && age < 16,
      guardianId: null,
      onboardingDone: false,
      createdAt: nowIso()
    })
    const session = createSession(state, { userId: user.id, role: 'student', device: device || 'Este aparelho · Navegador' })
    state.sessions.forEach((s) => (s.current = s.id === session.id))
    appendAudit(state, { actor: user.id, actorRole: 'student', action: 'account_created', target: user.id, details: { minor: user.isMinor, under13: age !== null && age < 13 } })
    res.status(201).json({ token: session.token, sessionId: session.id, user: publicUser(state, user), age, requiresGuardianConsent: age !== null && age < 13, nextStep: 'confirm' })
  })

  r.post('/auth/confirm', requireStudent, (req, res) => {
    const { channel, code } = req.body || {}
    if (!['email', 'phone'].includes(channel)) return fail(res, 422, 'validation', 'Canal inválido.')
    if (String(code) !== '123456') return fail(res, 422, 'invalid_code', 'Código incorreto. No protótipo, o código é 123456.')
    req.user.verified = { ...req.user.verified, [channel]: true }
    res.json({ verified: req.user.verified, user: publicUser(req.store.state, req.user) })
  })

  r.post('/auth/resend', requireStudent, (req, res) => {
    const { channel } = req.body || {}
    res.json({ sent: true, channel, hint: 'No protótipo, o código é 123456.' })
  })

  r.post('/auth/age-verification', requireStudent, (req, res) => {
    const state = req.store.state
    const { method = 'documento + prova de vida', guardian } = req.body || {}
    const age = ageFrom(req.user.birthDate)
    const needsGuardian = age !== null && age < 16
    if (needsGuardian && !guardian?.name) {
      return res.json({ status: 'aguardando_responsavel', requiresGuardian: true, age, message: 'Contas até 16 anos ficam vinculadas a um responsável verificado.' })
    }
    const verifiedAt = nowIso()
    req.user.ageVerification = {
      status: 'aprovado',
      method,
      provider: 'Verificador homologado',
      verifiedAt,
      documentDeletedBy: hoursFromNow(24),
      documentHash: sha256(`${req.user.id}:${verifiedAt}`).slice(0, 12),
      verifiedBy: 'Verificador homologado'
    }
    if (needsGuardian) {
      req.user.isMinor = true
      req.user.guardianId = 'g1'
      state.parental.guardian = { ...state.parental.guardian, name: guardian.name, email: guardian.email || state.parental.guardian.email, phone: guardian.phone || state.parental.guardian.phone }
      state.parental.child = { ...state.parental.child, name: req.user.name, age, birthDate: req.user.birthDate, verifiedAt }
    }
    appendAudit(state, { actor: 'verifier', actorRole: 'third_party', action: 'age_verified', target: req.user.id, details: { method, retained: ['resultado', 'método', 'data', 'hash', 'verificador'] } })
    res.json({ status: 'aprovado', ageVerification: req.user.ageVerification, isMinor: req.user.isMinor, user: publicUser(state, req.user) })
  })

  r.post('/auth/onboarding', requireStudent, (req, res) => {
    const state = req.store.state
    const { context, subjects = [], minutesPerDay = 10, objective } = req.body || {}
    const goal = Math.max(5, Math.round((minutesPerDay * 60) / 20 / 5) * 5)
    const study = state.study[req.user.id]
    study.goal = goal
    study.goalSuggested = goal
    req.user.onboarding = { context, subjects, minutesPerDay, at: nowIso() }
    req.user.onboardingDone = true
    let created = null
    if (objective?.name && objective?.date) {
      created = { id: `o_${Date.now().toString(36)}`, userId: req.user.id, name: objective.name, date: objective.date, subjects, outcome: null, outcomeRewarded: false, createdAt: nowIso() }
      state.objectives.push(created)
    }
    res.json({ goal, objective: created, planOfDay: { minutes: minutesPerDay, cards: goal } })
  })

  r.post('/auth/password/recover', (req, res) => {
    const { email } = req.body || {}
    if (!/.+@.+\..+/.test(email || '')) return fail(res, 422, 'validation', 'Digite um e-mail válido.')
    res.json({ sent: true, message: 'Se este e-mail tiver conta, enviamos um link de redefinição.' })
  })

  r.post('/auth/logout', requireStudent, (req, res) => {
    const state = req.store.state
    state.sessions = state.sessions.filter((s) => s.id !== req.session.id)
    res.json({ ok: true })
  })

  return r
}
