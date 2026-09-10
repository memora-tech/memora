import { dayKey, daysFromNow, nowIso } from './ids.js'
import { isDue } from './fsrs.js'
import { balanceOf } from './ledger.js'
import { weekKey } from '../seed/index.js'

export const PLAN_LIMITS = {
  free: { decksPerDay: 3, pinLimit: 5, slaHours: 72, generationTokens: { input: 4000, output: 1500 }, queuePriority: 'gratuito' },
  premium: { decksPerDay: 10, pinLimit: 20, slaHours: 24, generationTokens: { input: 10000, output: 4000 }, queuePriority: 'premium' }
}

export const httpError = (status, code, message, extra = {}) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  err.extra = extra
  return err
}

export const fail = (res, status, code, message, extra = {}) => res.status(status).json({ code, message, ...extra })

export function publicUser(state, user) {
  const study = state.study[user.id]
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate,
    isMinor: user.isMinor,
    guardianId: user.guardianId,
    plan: user.plan,
    locale: user.locale,
    timezone: user.timezone,
    verified: user.verified,
    canEarn: Boolean(user.verified?.email && user.verified?.phone),
    ageVerification: user.ageVerification,
    createdAt: user.createdAt,
    deactivatedAt: user.deactivatedAt || null,
    publicProfile: user.publicProfile,
    settings: user.settings || {},
    guardianPermissions: user.isMinor ? state.parental.permissions : null,
    streak: study?.streak ?? 0,
    studyDays: study?.studyDays ?? 0,
    balance: balanceOf(state, user.id),
    onboardingDone: user.onboardingDone !== false
  }
}

export function userTimezone(state, userId) {
  return state.users.find((u) => u.id === userId)?.timezone || 'America/Sao_Paulo'
}

export function ensureDay(state, userId) {
  const s = state.study[userId]
  const tz = userTimezone(state, userId)
  const today = dayKey(nowIso(), tz)
  const yesterday = dayKey(daysFromNow(-1), tz)
  if (s.dayKey !== today) {
    s.dayKey = today
    s.doneToday = 0
    if (s.lastStudyDay && s.lastStudyDay !== yesterday && s.lastStudyDay !== today && s.skippedDay !== yesterday) {
      s.streak = 0
    }
  }
  const wk = weekKey()
  if (s.reschedules.weekKey !== wk) {
    s.reschedules = { weekKey: wk, used: 0, limit: 3 }
  }
  const q = state.generation.quota[userId]
  if (q && q.dayKey !== today) {
    q.dayKey = today
    q.used = 0
  }
  const b = state.noa.budget[userId]
  if (b && b.dayKey !== today) {
    b.dayKey = today
    b.suggestionsUsed = 0
    b.autonomousUsed = 0
  }
  return s
}

export function ownDecksOf(state, userId) {
  return state.decks.filter((d) => d.ownerId === userId && !d.deletedAt)
}

export function cardsOfDeck(state, deckId) {
  return state.cards.filter((c) => c.deckId === deckId && !c.deletedAt)
}

export function deckProgress(state, deck) {
  const cards = cardsOfDeck(state, deck.id)
  const due = cards.filter((c) => isDue(c.sched)).length
  const mastered = cards.filter((c) => (c.sched?.stability || 0) >= 21).length
  const recent = deck.lastStudiedAt && new Date(deck.lastStudiedAt).getTime() >= Date.now() - 7 * 86400000
  return {
    total: cards.length,
    due,
    mastered,
    learning: cards.length - mastered,
    offlineAvailable: Boolean(recent || deck.pinned),
    offlineReason: deck.pinned ? 'fixado' : recent ? 'recente' : null
  }
}

export function categoryName(state, id) {
  return state.categories.find((c) => c.id === id)?.name || 'Outros'
}

export function authorPublic(state, author, viewerId) {
  const following = state.community.follows.some((f) => f.userId === viewerId && f.authorId === author.id)
  return { ...author, following }
}

export function communityDeckPublic(state, deck, viewerId) {
  const author = state.community.authors.find((a) => a.id === deck.authorId)
  const cards = state.community.cards.filter((c) => c.deckId === deck.id)
  const favorited = state.community.favorites.some((f) => f.userId === viewerId && f.deckId === deck.id)
  const voted = state.community.votes.some((v) => v.userId === viewerId && v.deckId === deck.id)
  const answered = state.community.answered[viewerId]?.[deck.id] || 0
  const total = cards.length
  const canVote = answered >= 20 || (total > 0 && answered / total >= 0.3)
  const myReactions = state.community.myReactions.filter((r) => r.userId === viewerId && r.deckId === deck.id).map((r) => r.emoji)
  const cloned = state.decks.some((d) => d.ownerId === viewerId && d.clonedFrom?.deckId === deck.id && !d.deletedAt)
  const commentCount = state.community.comments.filter((c) => c.deckId === deck.id).reduce((n, c) => n + 1 + c.replies.length, 0)
  return {
    ...deck,
    categoryName: categoryName(state, deck.categoryId),
    author: author ? authorPublic(state, author, viewerId) : null,
    cardCount: total,
    commentCount,
    viewer: { favorited, voted, canVote, answered, total, voteRule: { minPct: 30, minCards: 20 }, myReactions, cloned }
  }
}

export function materializedAt() {
  const d = new Date()
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0)
  return d.toISOString()
}

export function addParentalRequest(state, { type, title, detail }) {
  const existing = state.parental.requests.find((r) => r.type === type && r.status === 'pendente')
  if (existing) return existing
  const req = { id: `req_${Date.now().toString(36)}`, type, title, detail, createdAt: nowIso(), status: 'pendente' }
  state.parental.requests.unshift(req)
  return req
}

export const GUARDIAN_LABELS = {
  community: 'Liberar comunidade',
  publicLink: 'Compartilhar link público',
  externalMembers: 'Membros externos em pastas',
  schoolShare: 'Compartilhar desempenho com a escola',
  whatsappInfo: 'WhatsApp informativo'
}

export function guardianGate(state, user, permission, detail) {
  if (!user.isMinor) return null
  if (state.parental.permissions[permission]) return null
  const request = addParentalRequest(state, { type: permission, title: GUARDIAN_LABELS[permission], detail })
  return { code: 'guardian_required', permission, request }
}

export function requireVerified(user) {
  if (user.verified?.email && user.verified?.phone) return null
  return { code: 'verification_required', missing: [!user.verified?.email && 'email', !user.verified?.phone && 'phone'].filter(Boolean) }
}
