import { Router } from 'express'
import { FEATURES } from '../config/features.js'
import { ensureStoreUser, requireStudent } from '../lib/auth.js'
import {
  addParentalRequest,
  ensureDay,
  fail,
  GUARDIAN_LABELS,
  publicUser
} from '../lib/helpers.js'
import { credit } from '../lib/ledger.js'
import { dayKey } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export function meRoutes(features = FEATURES) {
  const r = Router()

  r.get('/me', requireStudent, async (req, res, next) => {
    try {
      if (req.useSupabase && req.db) {
        const { today, study } = await req.data.profiles.ensureDay(req.db, req.user)
        let dailyCredit = null
        if (!req.user.deactivatedAt && req.user.verified?.email) {
          dailyCredit = await req.data.ledger.creditDailyAccess(req.db, req.user.id, today)
        }
        const [balance, consents, subscription] = await Promise.all([
          dailyCredit
            ? Promise.resolve(dailyCredit.balanceAfter)
            : req.data.ledger.getBalance(req.db, req.user.id),
          req.data.profiles.getConsents(req.db, req.user.id),
          req.data.profiles.getSubscriptionSummary(req.user)
        ])
        const userView = {
          ...req.user,
          streak: study?.streak ?? req.user.streak ?? 0,
          studyDays: study?.studyDays ?? req.user.studyDays ?? 0,
          balance
        }
        ensureStoreUser(req.store?.state, userView)
        return res.json({
          user: publicUser(req.store?.state || null, userView),
          dailyCredit,
          notifications: userView.notifications,
          consents,
          subscription
        })
      }

      const state = req.store.state
      ensureDay(state, req.user.id)
      let dailyCredit = null
      const tz = req.user.timezone || 'America/Sao_Paulo'
      const today = dayKey(new Date().toISOString(), tz)
      const alreadyCredited = state.ledger.some(
        (e) => e.userId === req.user.id && e.type === 'daily_access' && dayKey(e.ts, tz) === today
      )
      if (!alreadyCredited && !req.user.deactivatedAt && req.user.verified?.email) {
        dailyCredit = credit(state, req.user.id, 1, 'daily_access', { day: today })
      }
      return res.json({
        user: publicUser(state, req.user),
        dailyCredit,
        notifications: state.notifications[req.user.id],
        consents: state.consents[req.user.id],
        subscription: state.subscriptions[req.user.id]
      })
    } catch (err) {
      return next(err)
    }
  })

  r.patch('/me/settings', requireStudent, async (req, res, next) => {
    try {
      const body = req.body || {}
      if (body.intensity) {
        if (req.user.isMinor && body.intensity !== 'leve') {
          return fail(res, 403, 'intensity_locked', 'Contas de menores ficam sempre em "leve".')
        }
        if (!['leve', 'padrao', 'intenso'].includes(body.intensity)) {
          return fail(res, 422, 'validation', 'Intensidade inválida.')
        }
      }

      if (req.useSupabase && req.db) {
        const result = await req.data.profiles.updateSettings(req.db, req.user, body)
        ensureStoreUser(req.store?.state, result.user)
        if (req.store?.state?.study?.[req.user.id]) {
          req.store.state.study[req.user.id].goal = result.study.goal
          req.store.state.study[req.user.id].fatigueDetection = result.study.fatigueDetection
        }
        return res.json({
          user: publicUser(req.store?.state || null, result.user),
          notifications: result.notifications,
          study: result.study
        })
      }

      const state = req.store.state
      const notif = state.notifications[req.user.id]
      if (body.intensity) notif.intensity = body.intensity
      if (body.reminderTime) notif.reminderTime = body.reminderTime
      if (typeof body.push === 'boolean') notif.push = body.push
      if (body.timezone) req.user.timezone = body.timezone
      if (body.locale) req.user.locale = body.locale
      if (body.name) req.user.name = body.name
      if (typeof body.dailyGoal === 'number') {
        state.study[req.user.id].goal = Math.min(200, Math.max(5, body.dailyGoal))
      }
      if (typeof body.fatigueDetection === 'boolean') {
        state.study[req.user.id].fatigueDetection = body.fatigueDetection
      }
      if (body.accessibility) {
        req.user.settings = {
          ...(req.user.settings || {}),
          accessibility: { ...(req.user.settings?.accessibility || {}), ...body.accessibility }
        }
      }
      return res.json({
        user: publicUser(state, req.user),
        notifications: notif,
        study: {
          goal: state.study[req.user.id].goal,
          fatigueDetection: state.study[req.user.id].fatigueDetection
        }
      })
    } catch (err) {
      return next(err)
    }
  })

  r.get('/me/sessions', requireStudent, (req, res) => {
    if (req.useSupabase) {
      return res.json({
        sessions: [
          {
            id: req.session.id,
            device: req.session.device,
            location: req.session.location,
            createdAt: req.session.createdAt,
            lastUsedAt: req.session.lastUsedAt,
            current: true
          }
        ],
        policy: { expiresAfterDays: 30, sliding: true, deviceLimit: null }
      })
    }
    const state = req.store.state
    const sessions = state.sessions
      .filter((s) => s.userId === req.user.id)
      .map((s) => ({
        id: s.id,
        device: s.device,
        location: s.location,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: s.id === req.session.id
      }))
      .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.lastUsedAt.localeCompare(a.lastUsedAt)))
    return res.json({
      sessions,
      policy: { expiresAfterDays: 30, sliding: true, deviceLimit: null }
    })
  })

  r.delete('/me/sessions/:id', requireStudent, (req, res) => {
    if (req.params.id === req.session.id) {
      return fail(res, 409, 'current_session', 'Para sair deste aparelho, use "Sair".')
    }
    if (req.store?.state?.sessions) {
      req.store.state.sessions = req.store.state.sessions.filter(
        (s) => !(s.id === req.params.id && s.userId === req.user.id)
      )
    }
    return res.json({ ok: true })
  })

  r.delete('/me/sessions', requireStudent, (req, res) => {
    if (req.store?.state?.sessions) {
      req.store.state.sessions = req.store.state.sessions.filter(
        (s) => s.userId !== req.user.id || s.id === req.session.id
      )
    }
    return res.json({ ok: true, kept: req.session.id })
  })

  r.post('/me/password', requireStudent, async (req, res, next) => {
    try {
      const { current, next: nextPassword } = req.body || {}
      if (!current || !nextPassword || String(nextPassword).length < 8) {
        return fail(res, 422, 'validation', 'A nova senha precisa ter ao menos 8 caracteres.')
      }
      if (req.useSupabase && req.db) {
        await req.data.profiles.changePassword(req.db, req.user, {
          current,
          next: nextPassword
        })
        await req.data.audit.append({
          actor: req.user.id,
          actorRole: 'student',
          action: 'password_changed',
          target: req.user.id,
          details: { otherSessionsEnded: true }
        })
        return res.json({ ok: true, otherSessionsEnded: true })
      }
      const state = req.store.state
      state.sessions = state.sessions.filter(
        (s) => s.userId !== req.user.id || s.id === req.session.id
      )
      appendAudit(state, {
        actor: req.user.id,
        actorRole: 'student',
        action: 'password_changed',
        target: req.user.id,
        details: { otherSessionsEnded: true }
      })
      return res.json({ ok: true, otherSessionsEnded: true })
    } catch (err) {
      return next(err)
    }
  })

  r.get('/me/consents', requireStudent, async (req, res, next) => {
    try {
      if (req.useSupabase && req.db) {
        const consents = await req.data.profiles.getConsents(req.db, req.user.id)
        return res.json({ consents, guardianPermissions: null })
      }
      return res.json({
        consents: req.store.state.consents[req.user.id],
        guardianPermissions: req.user.isMinor ? req.store.state.parental.permissions : null
      })
    } catch (err) {
      return next(err)
    }
  })

  r.patch('/me/consents', requireStudent, async (req, res, next) => {
    try {
      const body = req.body || {}
      if (req.useSupabase && req.db) {
        const consents = await req.data.profiles.updateConsents(req.db, req.user.id, body)
        await req.data.audit.append({
          actor: req.user.id,
          actorRole: 'student',
          action: 'consents_updated',
          target: req.user.id,
          details: body
        })
        if (req.store?.state?.consents) {
          req.store.state.consents[req.user.id] = consents
        }
        return res.json({ consents })
      }

      const state = req.store.state
      const consents = state.consents[req.user.id]
      if (typeof body.schoolShare === 'boolean') {
        if (req.user.isMinor && body.schoolShare && !state.parental.permissions.schoolShare) {
          const request = addParentalRequest(state, {
            type: 'schoolShare',
            title: GUARDIAN_LABELS.schoolShare,
            detail: 'O aluno quer compartilhar o desempenho com a escola.'
          })
          return fail(
            res,
            403,
            'guardian_required',
            'Esta liberação depende do seu responsável.',
            { permission: 'schoolShare', request }
          )
        }
        consents.schoolShare = body.schoolShare
      }
      if (body.whatsapp) {
        if (
          req.user.isMinor &&
          body.whatsapp.informativo &&
          !state.parental.permissions.whatsappInfo
        ) {
          const request = addParentalRequest(state, {
            type: 'whatsappInfo',
            title: GUARDIAN_LABELS.whatsappInfo,
            detail: 'O aluno quer receber o WhatsApp informativo (2× por semana).'
          })
          return fail(
            res,
            403,
            'guardian_required',
            'Esta liberação depende do seu responsável.',
            { permission: 'whatsappInfo', request }
          )
        }
        consents.whatsapp = { ...consents.whatsapp, ...body.whatsapp }
      }
      appendAudit(state, {
        actor: req.user.id,
        actorRole: 'student',
        action: 'consents_updated',
        target: req.user.id,
        details: body
      })
      return res.json({ consents })
    } catch (err) {
      return next(err)
    }
  })

  if (features.guardian) {
    r.get('/me/guardian-requests', requireStudent, (req, res) => {
      res.json({ requests: req.user.isMinor ? req.store.state.parental.requests : [] })
    })

    r.post('/me/guardian-requests', requireStudent, (req, res) => {
      const { type, detail } = req.body || {}
      if (!GUARDIAN_LABELS[type]) {
        return fail(res, 422, 'validation', 'Tipo de solicitação inválido.')
      }
      const request = addParentalRequest(req.store.state, {
        type,
        title: GUARDIAN_LABELS[type],
        detail: detail || ''
      })
      return res.status(201).json({ request })
    })
  }

  return r
}
