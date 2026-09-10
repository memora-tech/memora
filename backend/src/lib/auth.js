import { id, nowIso } from './ids.js'

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
  const session = state.sessions.find((s) => s.token === token) || null
  if (!session) return null
  if (Date.now() - new Date(session.lastUsedAt).getTime() > SESSION_TTL_DAYS * 86400000) {
    state.sessions = state.sessions.filter((s) => s.id !== session.id)
    return null
  }
  return session
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    const session = token ? findSession(req.store.state, token) : null
    if (!session) {
      return res.status(401).json({ code: 'unauthorized', message: 'Sessão inválida ou expirada.' })
    }
    if (roles.length && !roles.includes(session.role)) {
      return res.status(403).json({ code: 'forbidden', message: 'Sem permissão para esta área.' })
    }
    session.lastUsedAt = nowIso()
    req.session = session
    req.user = req.store.state.users.find((u) => u.id === session.userId) || null
    next()
  }
}

export const requireStudent = requireRole('student')
