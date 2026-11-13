import crypto from 'node:crypto'
import { Router } from 'express'
import { FEATURES } from '../config/features.js'
import { createServiceClient, createUserClient } from '../data/supabase.js'
import { ageFrom, createSession, ensureStoreUser, requireStudent } from '../lib/auth.js'
import { fail, publicUser } from '../lib/helpers.js'
import { hoursFromNow, nowIso, sha256 } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'
import { rateLimit } from '../lib/rateLimit.js'

function timingSafeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function authRoutes(features = FEATURES) {
  const r = Router()
  const authLimiter = rateLimit({
    scope: 'auth',
    maxHits: 10,
    windowSeconds: 900,
    keyFrom: (req) => req.ip || 'local'
  })

  r.post('/auth/login', authLimiter, async (req, res, next) => {
    try {
      const { provider = 'email', email, password, device } = req.body || {}
      if (provider !== 'email' || !email || !password) {
        return fail(res, 422, 'invalid_credentials', 'Informe e-mail e senha.')
      }

      if (req.useSupabase) {
        const buildClient = req.createUserClient || createUserClient
        const anonClient = buildClient()
        const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
          email: String(email).trim().toLowerCase(),
          password: String(password)
        })
        if (signInErr || !signInData?.session || !signInData?.user) {
          return fail(res, 401, 'invalid_credentials', 'E-mail ou senha incorretos.')
        }

        const accessToken = signInData.session.access_token
        const refreshToken = signInData.session.refresh_token || null
        const userDb = buildClient(accessToken)
        const user = await req.data.profiles.getById(userDb, signInData.user.id)
        if (!user) {
          return fail(res, 401, 'invalid_credentials', 'Perfil de usuário não encontrado.')
        }

        const age = ageFrom(user.birthDate)
        if (age !== null && age < 18) {
          return fail(res, 403, 'forbidden', 'O Memora é exclusivo para maiores de 18 anos.')
        }

        ensureStoreUser(req.store?.state, user)
        return res.json({
          token: accessToken,
          refreshToken,
          sessionId: `jwt_${user.id}`,
          user: publicUser(req.store?.state || null, user),
          provider
        })
      }

      const state = req.store.state
      const user = state.users.find((u) => u.id === 'u1')
      const session = createSession(state, {
        userId: user.id,
        role: 'student',
        device: device || 'Este aparelho · Navegador'
      })
      state.sessions.forEach((s) => (s.current = s.id === session.id))
      return res.json({
        token: session.token,
        sessionId: session.id,
        user: publicUser(state, user),
        provider
      })
    } catch (err) {
      return next(err)
    }
  })

  r.post('/auth/register', authLimiter, async (req, res, next) => {
    try {
      const {
        name,
        email,
        password,
        phone,
        birthDate,
        inviteCode,
        student = true,
        origin,
        device
      } = req.body || {}

      const expectedInvite =
        req.inviteCode !== undefined
          ? String(req.inviteCode)
          : String(process.env.INVITE_CODE || 'MEMORA-MVP-2026')

      if (!inviteCode || !timingSafeEqualStrings(String(inviteCode).trim(), expectedInvite.trim())) {
        return fail(res, 403, 'invalid_invite_code', 'Código de convite inválido ou ausente.', {
          errors: { inviteCode: 'Informe um código de convite válido.' }
        })
      }

      if (birthDate) {
        const checkAge = ageFrom(birthDate)
        if (checkAge === null || checkAge < 18) {
          return fail(res, 422, 'under_age', 'O Memora é exclusivo para maiores de 18 anos.', {
            errors: { birthDate: 'Você precisa ter pelo menos 18 anos para criar uma conta.' }
          })
        }
      }

      const errors = {}
      if (!name || name.trim().length < 2) errors.name = 'Escreva seu nome como quer ser chamado.'
      if (!/.+@.+\..+/.test(email || '')) errors.email = 'Digite um e-mail com @ para continuar.'
      if (!password || String(password).length < 8) {
        errors.password = 'Crie uma senha com pelo menos 8 caracteres.'
      }
      if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
        const digits = String(phone).replace(/\D/g, '')
        if (digits.length < 10 || digits.length > 13) {
          errors.phone = 'Digite DDD e número, com 10 ou 11 dígitos.'
        }
      }
      if (!birthDate) errors.birthDate = 'Informe sua data de nascimento.'
      if (student !== true && student !== false) errors.student = 'Escolha sim ou não.'
      if (Object.keys(errors).length) {
        return fail(res, 422, 'validation', 'Confira os campos marcados.', { errors })
      }

      const age = ageFrom(birthDate)
      if (age === null || age < 18) {
        return fail(res, 422, 'under_age', 'O Memora é exclusivo para maiores de 18 anos.', {
          errors: { birthDate: 'Você precisa ter pelo menos 18 anos para criar uma conta.' }
        })
      }

      if (req.useSupabase) {
        const serviceClient = req.serviceClient || createServiceClient()
        const normalizedEmail = String(email).trim().toLowerCase()
        const { data: createdAuth, error: createErr } = await serviceClient.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: { name: name.trim() }
        })
        if (createErr || !createdAuth?.user) {
          return fail(
            res,
            409,
            'email_already_registered',
            createErr?.message || 'Não foi possível criar a conta com este e-mail.'
          )
        }

        const user = await req.data.profiles.provisionNewStudent({
          id: createdAuth.user.id,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? String(phone).trim() : null,
          birthDate,
          isStudent: student,
          origin: origin || null
        })

        await req.data.audit.append({
          actor: user.id,
          actorRole: 'student',
          action: 'account_created',
          target: user.id,
          details: { minor: false, under13: false }
        })

        const buildClient = req.createUserClient || createUserClient
        const anonClient = buildClient()
        const { data: signInData } = await anonClient.auth.signInWithPassword({
          email: normalizedEmail,
          password: String(password)
        })
        const accessToken = signInData?.session?.access_token || `jwt_${user.id}`
        const refreshToken = signInData?.session?.refresh_token || null

        ensureStoreUser(req.store?.state, user)
        return res.status(201).json({
          token: accessToken,
          refreshToken,
          sessionId: `jwt_${user.id}`,
          user: publicUser(req.store?.state || null, user),
          age,
          requiresGuardianConsent: false,
          nextStep: 'onboarding'
        })
      }

      const state = req.store.state
      const ip = req.ip || 'local'
      const bucket = (state.registrationsByIp[ip] = state.registrationsByIp[ip] || [])
      const since = Date.now() - 24 * 3600 * 1000
      const recent = bucket.filter((ts) => ts > since)
      if (recent.length >= 5 && !req.body.captchaToken) {
        return fail(
          res,
          429,
          'captcha_required',
          'Muitas contas criadas neste dispositivo nas últimas 24 h. Complete o desafio para continuar.',
          { limit: 5 }
        )
      }
      bucket.push(Date.now())

      const user = state.users.find((u) => u.id === 'u1')
      Object.assign(user, {
        name: name.trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone || null,
        birthDate,
        origin: origin || null,
        isStudent: student,
        verified: { email: true, phone: Boolean(phone) },
        ageVerification: { status: 'aprovado', method: 'cadastro_maior_18', provider: 'Supabase Auth' },
        isMinor: false,
        guardianId: null,
        onboardingDone: false,
        createdAt: nowIso()
      })
      const session = createSession(state, {
        userId: user.id,
        role: 'student',
        device: device || 'Este aparelho · Navegador'
      })
      state.sessions.forEach((s) => (s.current = s.id === session.id))
      appendAudit(state, {
        actor: user.id,
        actorRole: 'student',
        action: 'account_created',
        target: user.id,
        details: { minor: false, under13: false }
      })
      return res.status(201).json({
        token: session.token,
        sessionId: session.id,
        user: publicUser(state, user),
        age,
        requiresGuardianConsent: false,
        nextStep: 'onboarding'
      })
    } catch (err) {
      return next(err)
    }
  })

  r.post('/auth/confirm', requireStudent, (req, res) => {
    const { channel = 'email', code } = req.body || {}
    if (channel !== 'email') return fail(res, 422, 'validation', 'Canal inválido.')
    if (!code || String(code).trim().length < 6) {
      return fail(res, 422, 'invalid_code', 'Código de confirmação inválido.')
    }
    req.user.verified = { ...req.user.verified, email: true }
    return res.json({
      verified: req.user.verified,
      user: publicUser(req.store?.state || null, req.user)
    })
  })

  r.post('/auth/resend', requireStudent, (req, res) => {
    const { channel = 'email' } = req.body || {}
    if (channel !== 'email') return fail(res, 422, 'validation', 'Canal inválido.')
    return res.json({ sent: true, channel })
  })

  if (features.ageVerification) {
    r.post('/auth/age-verification', requireStudent, (req, res) => {
      const state = req.store.state
      const { method = 'documento + prova de vida', guardian } = req.body || {}
      const age = ageFrom(req.user.birthDate)
      const needsGuardian = age !== null && age < 16
      if (needsGuardian && !guardian?.name) {
        return res.json({
          status: 'aguardando_responsavel',
          requiresGuardian: true,
          age,
          message: 'Contas até 16 anos ficam vinculadas a um responsável verificado.'
        })
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
        state.parental.guardian = {
          ...state.parental.guardian,
          name: guardian.name,
          email: guardian.email || state.parental.guardian.email,
          phone: guardian.phone || state.parental.guardian.phone
        }
        state.parental.child = {
          ...state.parental.child,
          name: req.user.name,
          age,
          birthDate: req.user.birthDate,
          verifiedAt
        }
      }
      appendAudit(state, {
        actor: 'verifier',
        actorRole: 'third_party',
        action: 'age_verified',
        target: req.user.id,
        details: { method, retained: ['resultado', 'método', 'data', 'hash', 'verificador'] }
      })
      return res.json({
        status: 'aprovado',
        ageVerification: req.user.ageVerification,
        isMinor: req.user.isMinor,
        user: publicUser(state, req.user)
      })
    })
  }

  r.post('/auth/onboarding', requireStudent, async (req, res, next) => {
    try {
      const { context, subjects = [], minutesPerDay = 10, objective } = req.body || {}
      if (req.useSupabase && req.db) {
        const result = await req.data.profiles.completeOnboarding(req.db, req.user.id, {
          context,
          subjects,
          minutesPerDay,
          objective
        })
        if (req.store?.state?.study?.[req.user.id]) {
          req.store.state.study[req.user.id].goal = result.goal
          req.store.state.study[req.user.id].goalSuggested = result.goal
          if (result.objective) req.store.state.objectives.push(result.objective)
        }
        return res.json(result)
      }

      const state = req.store.state
      const goal = Math.max(5, Math.round((minutesPerDay * 60) / 20 / 5) * 5)
      const study = state.study[req.user.id]
      study.goal = goal
      study.goalSuggested = goal
      req.user.onboarding = { context, subjects, minutesPerDay, at: nowIso() }
      req.user.onboardingDone = true
      let created = null
      if (objective?.name && objective?.date) {
        created = {
          id: `o_${Date.now().toString(36)}`,
          userId: req.user.id,
          name: objective.name,
          date: objective.date,
          subjects,
          outcome: null,
          outcomeRewarded: false,
          createdAt: nowIso()
        }
        state.objectives.push(created)
      }
      return res.json({ goal, objective: created, planOfDay: { minutes: minutesPerDay, cards: goal } })
    } catch (err) {
      return next(err)
    }
  })

  r.post('/auth/password/recover', authLimiter, async (req, res, next) => {
    try {
      const { email, redirectTo } = req.body || {}
      if (!/.+@.+\..+/.test(email || '')) {
        return fail(res, 422, 'validation', 'Digite um e-mail válido.')
      }
      if (req.useSupabase) {
        const buildClient = req.createUserClient || createUserClient
        const anonClient = buildClient()
        await anonClient.auth.resetPasswordForEmail(
          String(email).trim().toLowerCase(),
          redirectTo ? { redirectTo } : undefined
        )
      }
      return res.json({
        sent: true,
        message: 'Se este e-mail tiver conta, enviamos um link de redefinição.'
      })
    } catch (err) {
      return next(err)
    }
  })

  r.post('/auth/logout', requireStudent, async (req, res, next) => {
    try {
      if (req.useSupabase && req.db?.auth?.signOut) {
        await req.db.auth.signOut()
      }
      if (req.store?.state?.sessions) {
        req.store.state.sessions = req.store.state.sessions.filter((s) => s.id !== req.session.id)
      }
      return res.json({ ok: true })
    } catch (err) {
      return next(err)
    }
  })

  return r
}
