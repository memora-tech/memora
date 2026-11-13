import { dayKey, id, nowIso } from './ids.js'
import { weekKey } from '../seed/index.js'
import { createUserClient, isSupabaseConfigured } from '../data/supabase.js'

export function ensureStoreUser(state, user) {
  if (!state || !user?.id) return
  const existing = state.users.find((u) => u.id === user.id)
  if (existing) {
    Object.assign(existing, user)
  } else {
    state.users.push({ ...user })
  }
  const today = dayKey(nowIso(), user.timezone || 'America/Sao_Paulo')
  if (!state.study[user.id]) {
    state.study[user.id] = {
      goal: 20,
      goalSuggested: 20,
      doneToday: 0,
      dayKey: today,
      goalHitDay: null,
      reschedules: { weekKey: weekKey(), used: 0, limit: 3 },
      skippedDay: null,
      pausedUntil: null,
      pausedAt: null,
      streak: user.streak ?? 0,
      lastStudyDay: null,
      studyDays: user.studyDays ?? 0,
      fatigueDetection: true,
      fatigueKeepLoadDay: null,
      planOrder: [],
      planAdjustments: {}
    }
  }
  if (!state.notifications[user.id]) {
    state.notifications[user.id] = user.notifications || {
      intensity: 'padrao',
      reminderTime: '19:00',
      push: true,
      quietWindow: { start: '23:00', end: '07:30', learned: true, lockedForMinor: false },
      limits: { whatsappPerDay: 3, pushPerDay: 8 },
      sentToday: { whatsapp: 0, push: 0 }
    }
  }
  if (!state.consents[user.id]) {
    state.consents[user.id] = {
      schoolShare: false,
      whatsapp: { lembretes: true, conquistas: false, conta: true, informativo: false },
      contentPolicyAcceptedVersion: null
    }
  }
  if (!state.subscriptions[user.id]) {
    state.subscriptions[user.id] = {
      plan: user.plan || 'free',
      offer: { monthlyBRL: 29.9, yearlyBRL: 239.9, yearlyPerMonthBRL: 19.99 },
      payments: [],
      cancelledAt: null
    }
  }
  if (!state.generation.quota[user.id]) {
    state.generation.quota[user.id] = { dayKey: today, used: 0 }
  }
  if (!state.noa.budget[user.id]) {
    state.noa.budget[user.id] = {
      dayKey: today,
      suggestionsUsed: 0,
      suggestionsLimit: 5,
      autonomousUsed: 0,
      autonomousLimit: 1
    }
  }
}

export function ageFrom(birthDate) {
  if (!birthDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate).trim())
  const now = new Date()
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    let age = now.getUTCFullYear() - year
    const m = now.getUTCMonth() - month
    if (m < 0 || (m === 0 && now.getUTCDate() < day)) age -= 1
    return age
  }
  const parsed = new Date(birthDate)
  if (Number.isNaN(parsed.getTime())) return null
  let age = now.getFullYear() - parsed.getFullYear()
  const m = now.getMonth() - parsed.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) age -= 1
  return age
}

export function createSession(state, { userId, role, device = 'Navegador', location = 'São Paulo, BR' }) {
  const token = `tok_${id()}${id()}`
  const session = {
    id: id('ses'),
    token,
    userId,
    role,
    device,
    location,
    createdAt: nowIso(),
    lastUsedAt: nowIso(),
    current: false
  }
  state.sessions.push(session)
  return session
}

export const SESSION_TTL_DAYS = 30

export function findSession(state, token) {
  if (!state?.sessions) return null
  const session = state.sessions.find((s) => s.token === token) || null
  if (!session) return null
  if (Date.now() - new Date(session.lastUsedAt).getTime() > SESSION_TTL_DAYS * 86400000) {
    state.sessions = state.sessions.filter((s) => s.id !== session.id)
    return null
  }
  return session
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const header = req.get('authorization') || ''
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
      if (!token) {
        return res.status(401).json({ code: 'unauthorized', message: 'Sessão inválida ou expirada.' })
      }

      const useSupabase = Boolean(
        req.useSupabase || (!token.startsWith('tok_') && isSupabaseConfigured() && req.data?.profiles)
      )

      if (useSupabase) {
        const buildClient = req.createUserClient || createUserClient
        const db = buildClient(token)
        const { data: authData, error: authErr } = await db.auth.getUser(token)
        if (authErr || !authData?.user) {
          return res.status(401).json({ code: 'unauthorized', message: 'Sessão inválida ou expirada.' })
        }

        const user = await req.data.profiles.getById(db, authData.user.id)
        if (!user) {
          return res.status(401).json({ code: 'unauthorized', message: 'Sessão inválida ou expirada.' })
        }

        const age = ageFrom(user.birthDate)
        if (age !== null && age < 18) {
          return res.status(403).json({ code: 'forbidden', message: 'O Memora é exclusivo para maiores de 18 anos.' })
        }

        if (roles.length && !roles.includes(user.role || 'student')) {
          return res.status(403).json({ code: 'forbidden', message: 'Sem permissão para esta área.' })
        }

        req.db = db
        req.user = user
        ensureStoreUser(req.store?.state, user)
        req.session = {
          id: `jwt_${user.id}`,
          token,
          userId: user.id,
          role: user.role || 'student',
          device: 'Este aparelho · Navegador',
          location: 'Brasil',
          createdAt: user.createdAt || nowIso(),
          lastUsedAt: nowIso(),
          current: true
        }
        return next()
      }

      const session = req.store ? findSession(req.store.state, token) : null
      if (!session) {
        return res.status(401).json({ code: 'unauthorized', message: 'Sessão inválida ou expirada.' })
      }
      if (roles.length && !roles.includes(session.role)) {
        return res.status(403).json({ code: 'forbidden', message: 'Sem permissão para esta área.' })
      }
      session.lastUsedAt = nowIso()
      req.session = session
      req.user = req.store.state.users.find((u) => u.id === session.userId) || null
      return next()
    } catch (err) {
      return next(err)
    }
  }
}

export const requireStudent = requireRole('student')
