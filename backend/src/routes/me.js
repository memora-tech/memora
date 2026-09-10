import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, publicUser, ensureDay, addParentalRequest, GUARDIAN_LABELS } from '../lib/helpers.js'
import { credit } from '../lib/ledger.js'
import { dayKey } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export function meRoutes() {
  const r = Router()

  r.get('/me', requireStudent, (req, res) => {
    const state = req.store.state
    ensureDay(state, req.user.id)
    let dailyCredit = null
    const tz = req.user.timezone || 'America/Sao_Paulo'
    const today = dayKey(new Date().toISOString(), tz)
    const alreadyCredited = state.ledger.some((e) => e.userId === req.user.id && e.type === 'daily_access' && dayKey(e.ts, tz) === today)
    if (!alreadyCredited && !req.user.deactivatedAt && req.user.verified?.email && req.user.verified?.phone) {
      dailyCredit = credit(state, req.user.id, 1, 'daily_access', { day: today })
    }
    res.json({ user: publicUser(state, req.user), dailyCredit, notifications: state.notifications[req.user.id], consents: state.consents[req.user.id], subscription: state.subscriptions[req.user.id] })
  })

  r.patch('/me/settings', requireStudent, (req, res) => {
    const state = req.store.state
    const body = req.body || {}
    const notif = state.notifications[req.user.id]
    if (body.intensity) {
      if (req.user.isMinor && body.intensity !== 'leve') {
        return fail(res, 403, 'intensity_locked', 'Contas de menores ficam sempre em "leve".')
      }
      if (!['leve', 'padrao', 'intenso'].includes(body.intensity)) return fail(res, 422, 'validation', 'Intensidade inválida.')
      notif.intensity = body.intensity
    }
    if (body.reminderTime) notif.reminderTime = body.reminderTime
    if (typeof body.push === 'boolean') notif.push = body.push
    if (body.timezone) req.user.timezone = body.timezone
    if (body.locale) req.user.locale = body.locale
    if (body.name) req.user.name = body.name
    if (typeof body.dailyGoal === 'number') state.study[req.user.id].goal = Math.min(200, Math.max(5, body.dailyGoal))
    if (typeof body.fatigueDetection === 'boolean') state.study[req.user.id].fatigueDetection = body.fatigueDetection
    if (body.accessibility) req.user.settings = { ...(req.user.settings || {}), accessibility: { ...(req.user.settings?.accessibility || {}), ...body.accessibility } }
    res.json({ user: publicUser(state, req.user), notifications: notif, study: { goal: state.study[req.user.id].goal, fatigueDetection: state.study[req.user.id].fatigueDetection } })
  })

  r.get('/me/sessions', requireStudent, (req, res) => {
    const state = req.store.state
    const sessions = state.sessions
      .filter((s) => s.userId === req.user.id)
      .map((s) => ({ id: s.id, device: s.device, location: s.location, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, current: s.id === req.session.id }))
      .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.lastUsedAt.localeCompare(a.lastUsedAt)))
    res.json({ sessions, policy: { expiresAfterDays: 30, sliding: true, deviceLimit: null } })
  })

  r.delete('/me/sessions/:id', requireStudent, (req, res) => {
    const state = req.store.state
    if (req.params.id === req.session.id) return fail(res, 409, 'current_session', 'Para sair deste aparelho, use "Sair".')
    state.sessions = state.sessions.filter((s) => !(s.id === req.params.id && s.userId === req.user.id))
    res.json({ ok: true })
  })

  r.delete('/me/sessions', requireStudent, (req, res) => {
    const state = req.store.state
    state.sessions = state.sessions.filter((s) => s.userId !== req.user.id || s.id === req.session.id)
    res.json({ ok: true, kept: req.session.id })
  })

  r.post('/me/password', requireStudent, (req, res) => {
    const { current, next } = req.body || {}
    if (!current || !next || next.length < 8) return fail(res, 422, 'validation', 'A nova senha precisa ter ao menos 8 caracteres.')
    const state = req.store.state
    state.sessions = state.sessions.filter((s) => s.userId !== req.user.id || s.id === req.session.id)
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'password_changed', target: req.user.id, details: { otherSessionsEnded: true } })
    res.json({ ok: true, otherSessionsEnded: true })
  })

  r.get('/me/consents', requireStudent, (req, res) => {
    res.json({ consents: req.store.state.consents[req.user.id], guardianPermissions: req.user.isMinor ? req.store.state.parental.permissions : null })
  })

  r.patch('/me/consents', requireStudent, (req, res) => {
    const state = req.store.state
    const consents = state.consents[req.user.id]
    const body = req.body || {}
    if (typeof body.schoolShare === 'boolean') {
      if (req.user.isMinor && body.schoolShare && !state.parental.permissions.schoolShare) {
        const request = addParentalRequest(state, { type: 'schoolShare', title: GUARDIAN_LABELS.schoolShare, detail: 'O aluno quer compartilhar o desempenho com a escola.' })
        return fail(res, 403, 'guardian_required', 'Esta liberação depende do seu responsável.', { permission: 'schoolShare', request })
      }
      consents.schoolShare = body.schoolShare
    }
    if (body.whatsapp) {
      if (req.user.isMinor && body.whatsapp.informativo && !state.parental.permissions.whatsappInfo) {
        const request = addParentalRequest(state, { type: 'whatsappInfo', title: GUARDIAN_LABELS.whatsappInfo, detail: 'O aluno quer receber o WhatsApp informativo (2× por semana).' })
        return fail(res, 403, 'guardian_required', 'Esta liberação depende do seu responsável.', { permission: 'whatsappInfo', request })
      }
      consents.whatsapp = { ...consents.whatsapp, ...body.whatsapp }
    }
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'consents_updated', target: req.user.id, details: body })
    res.json({ consents })
  })

  r.get('/me/guardian-requests', requireStudent, (req, res) => {
    res.json({ requests: req.user.isMinor ? req.store.state.parental.requests : [] })
  })

  r.post('/me/guardian-requests', requireStudent, (req, res) => {
    const { type, detail } = req.body || {}
    if (!GUARDIAN_LABELS[type]) return fail(res, 422, 'validation', 'Tipo de solicitação inválido.')
    const request = addParentalRequest(req.store.state, { type, title: GUARDIAN_LABELS[type], detail: detail || '' })
    res.status(201).json({ request })
  })

  return r
}
