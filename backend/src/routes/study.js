import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, ensureDay, ownDecksOf, cardsOfDeck, deckProgress, PLAN_LIMITS, userTimezone } from '../lib/helpers.js'
import { isDue, schedule } from '../lib/fsrs.js'
import { credit, balanceOf } from '../lib/ledger.js'
import { dayKey, daysFromNow, nowIso, id } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const SECONDS_PER_CARD = 20

function inferSubjects(state, userId, name) {
  const lower = (name || '').toLowerCase()
  const decks = ownDecksOf(state, userId)
  let picked = []
  if (/enem|vestibular|fuvest|unicamp/.test(lower)) picked = decks.filter((d) => d.categoryId === 'vestibular')
  else if (/oab|concurso|trf|tribunal|inss|banco/.test(lower)) picked = decks.filter((d) => d.categoryId === 'concursos')
  else if (/ingl|toefl|ielts|espanhol|idioma/.test(lower)) picked = decks.filter((d) => d.categoryId === 'idiomas')
  else picked = decks.filter((d) => d.lastStudiedAt && new Date(d.lastStudiedAt).getTime() > Date.now() - 7 * 86400000)
  return picked.map((d) => d.name)
}

export function todaySession(state, userId) {
  const s = ensureDay(state, userId)
  const user = state.users.find((u) => u.id === userId)
  const tz = userTimezone(state, userId)
  const today = dayKey(nowIso(), tz)
  const decks = ownDecksOf(state, userId)
  const dueCards = state.cards
    .filter((c) => !c.deletedAt && decks.some((d) => d.id === c.deckId) && isDue(c.sched))
    .map((c) => ({ ...c, deckName: decks.find((d) => d.id === c.deckId)?.name }))

  const order = [...s.planOrder, ...decks.map((d) => d.id).filter((d) => !s.planOrder.includes(d))]
  const grouped = order
    .map((deckId) => {
      const deck = decks.find((d) => d.id === deckId)
      if (!deck) return null
      const available = dueCards.filter((c) => c.deckId === deckId)
      if (!available.length) return null
      const adjusted = s.planAdjustments[deckId]
      const count = typeof adjusted === 'number' ? Math.min(adjusted, available.length) : available.length
      return { deckId, deckName: deck.name, available: available.length, count, difficult: deck.difficult, focus: deck.focus, complementary: deck.complementary, cards: available.slice(0, count) }
    })
    .filter(Boolean)

  const focusFirst = grouped.slice().sort((a, b) => Number(b.focus) - Number(a.focus) || Number(b.difficult) - Number(a.difficult))
  const cards = focusFirst.flatMap((g) => g.cards)
  const total = cards.length
  const skippedToday = s.skippedDay === today
  const paused = s.pausedUntil && new Date(s.pausedUntil).getTime() > Date.now()
  const objectives = state.objectives.filter((o) => o.userId === userId)
  const upcoming = objectives.filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const nearest = upcoming[0] ? { ...upcoming[0], daysLeft: Math.round((new Date(upcoming[0].date) - new Date(today)) / 86400000), tie: upcoming.filter((o) => o.date === upcoming[0].date).length > 1 } : null
  const pendingOutcome = objectives.find((o) => o.date < today && !o.outcome) || null
  const suggestion = state.noa.suggestions.find((g) => g.userId === userId && g.status === 'pendente') || null
  const budget = state.noa.budget[userId]
  const suggestionsToday = state.noa.suggestions.filter((g) => g.userId === userId && dayKey(g.createdAt, tz) === today).length
  budget.suggestionsUsed = suggestionsToday
  const limits = PLAN_LIMITS[user.plan]
  const recentDeckIds = decks.filter((d) => deckProgress(state, d).offlineAvailable).map((d) => d.id)
  const minutes = Math.max(1, Math.ceil((total * SECONDS_PER_CARD) / 60))
  const history = state.reviews.filter((r) => r.userId === userId && r.durationMs).slice(-20)
  const personal = history.length
    ? { sample: history.length, avgMs: Math.round(history.reduce((n, r) => n + r.durationMs, 0) / history.length), errorRate: Number((history.filter((r) => r.rating === 'again').length / history.length).toFixed(2)) }
    : null

  return {
    date: today,
    status: paused ? 'pausado' : skippedToday ? 'reagendado' : total === 0 && s.doneToday > 0 ? 'concluido' : total === 0 ? 'sem_cards' : 'pronto',
    goal: s.goal,
    goalSuggested: s.goalSuggested,
    doneToday: s.doneToday,
    goalHitToday: s.goalHitDay === today,
    cardsDue: total,
    estimatedMinutes: minutes,
    plan: focusFirst.map(({ cards: _c, ...g }) => g),
    cards,
    streak: s.streak,
    reschedules: s.reschedules,
    pausedUntil: paused ? s.pausedUntil : null,
    nearestObjective: nearest,
    pendingOutcome,
    objectivesCount: objectives.length,
    noaSuggestion: suggestion && suggestionsToday <= budget.suggestionsLimit ? suggestion : null,
    noaBudget: budget,
    fatigue: { enabled: s.fatigueDetection, keepLoadToday: s.fatigueKeepLoadDay === today, signals: { responseTimeFactor: 2, errorRateFactor: 1.5, sessionMinutes: 45, required: 2, window: 20 }, personal },
    offline: { recentDeckIds, pinLimit: limits.pinLimit, recentDays: 7 },
    balance: balanceOf(state, userId),
    timezone: user.timezone
  }
}

export function studyRoutes() {
  const r = Router()

  r.get('/study/today', requireStudent, (req, res) => {
    res.json(todaySession(req.store.state, req.user.id))
  })

  r.post('/reviews', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const reviews = Array.isArray(req.body?.reviews) ? req.body.reviews : []
    const tz = userTimezone(state, req.user.id)
    const today = dayKey(nowIso(), tz)
    const yesterday = dayKey(daysFromNow(-1), tz)
    const accepted = []
    const duplicates = []
    const rewards = []
    const flagged = []

    for (const rv of reviews) {
      if (!rv.clientId || !rv.cardId || !rv.rating) continue
      if (state.reviews.some((x) => x.clientId === rv.clientId)) {
        duplicates.push(rv.clientId)
        continue
      }
      const reviewedAt = rv.reviewedAt || nowIso()
      const skewHours = Math.abs(new Date(reviewedAt).getTime() - Date.now()) / 3600000
      const plausible = skewHours <= 24
      const entry = { id: id('rev'), clientId: rv.clientId, userId: req.user.id, cardId: rv.cardId, rating: rv.rating, reviewedAt, receivedAt: nowIso(), durationMs: rv.durationMs || null, offline: Boolean(rv.offline), plausible }
      state.reviews.push(entry)
      accepted.push(rv.clientId)
      if (!plausible) flagged.push(rv.clientId)

      const card = state.cards.find((c) => c.id === rv.cardId)
      if (card) {
        card.sched = schedule(card.sched, rv.rating, reviewedAt)
        const deck = state.decks.find((d) => d.id === card.deckId)
        if (deck) deck.lastStudiedAt = reviewedAt
      } else if (rv.cardId.startsWith('c')) {
        const deckId = rv.cardId.split('_')[0]
        const answered = (state.community.answered[req.user.id] = state.community.answered[req.user.id] || {})
        answered[deckId] = (answered[deckId] || 0) + 1
      }

      s.doneToday += 1
      const reviewDay = plausible ? dayKey(reviewedAt, tz) : today
      const gapOk = !s.lastStudyAt || new Date(reviewedAt).getTime() - new Date(s.lastStudyAt).getTime() >= 20 * 3600000
      if (s.lastStudyDay !== reviewDay && gapOk) {
        if (s.lastStudyDay === yesterday || s.skippedDay === yesterday || !s.lastStudyDay) s.streak += 1
        else if (s.lastStudyDay !== today) s.streak = 1
        s.lastStudyDay = reviewDay
        s.studyDays += 1
        s.lastStudyAt = reviewedAt
      }
      if (!plausible) {
        state.antifraud = state.antifraud || []
        state.antifraud.push({ reviewId: entry.id, userId: req.user.id, reviewedAt, receivedAt: entry.receivedAt, skewHours: Math.round(skewHours), status: 'em_revisao' })
      }
    }

    if (s.doneToday >= s.goal && s.goalHitDay !== today && req.user.verified?.email && req.user.verified?.phone) {
      s.goalHitDay = today
      rewards.push(credit(state, req.user.id, 5, 'goal_bonus', { goal: s.goal, day: today }))
    }

    res.json({ accepted, duplicates, flagged, doneToday: s.doneToday, goal: s.goal, goalHitToday: s.goalHitDay === today, streak: s.streak, studyDays: s.studyDays, rewards, balance: balanceOf(state, req.user.id) })
  })

  r.post('/study/complete', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const tz = userTimezone(state, req.user.id)
    const today = dayKey(nowIso(), tz)
    const todays = state.reviews.filter((x) => x.userId === req.user.id && dayKey(x.reviewedAt, tz) === today)
    const correct = todays.filter((x) => x.rating === 'good' || x.rating === 'easy').length
    const earnedToday = state.ledger.filter((e) => e.userId === req.user.id && e.amount > 0 && dayKey(e.ts, tz) === today)
    const objectives = state.objectives.filter((o) => o.userId === req.user.id)
    const pendingOutcome = objectives.find((o) => o.date < today && !o.outcome) || null
    res.json({
      cardsReviewed: s.doneToday,
      accuracy: todays.length ? Math.round((correct / todays.length) * 100) : null,
      streak: s.streak,
      goal: s.goal,
      goalHit: s.goalHitDay === today,
      neuronsEarnedToday: earnedToday.reduce((n, e) => n + e.amount, 0),
      earnedEntries: earnedToday,
      balance: balanceOf(state, req.user.id),
      pendingOutcome,
      remainingDue: todaySession(state, req.user.id).cardsDue
    })
  })

  r.post('/study/skip', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    if (s.reschedules.used >= s.reschedules.limit) {
      return fail(res, 409, 'reschedule_limit', 'Você já reagendou 3 vezes nesta semana.', { reschedules: s.reschedules })
    }
    s.reschedules.used += 1
    s.skippedDay = dayKey(nowIso(), userTimezone(state, req.user.id))
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'goal_rescheduled', target: req.user.id, details: { used: s.reschedules.used } })
    res.json(todaySession(state, req.user.id))
  })

  r.post('/study/undo-skip', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    if (s.skippedDay === dayKey(nowIso(), userTimezone(state, req.user.id))) {
      s.skippedDay = null
      s.reschedules.used = Math.max(0, s.reschedules.used - 1)
    }
    res.json(todaySession(state, req.user.id))
  })

  r.post('/study/pause', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const days = Number(req.body?.days)
    if (!Number.isInteger(days) || days < 1 || days > 30) return fail(res, 422, 'validation', 'Escolha entre 1 e 30 dias.')
    s.pausedUntil = daysFromNow(days, 6)
    s.pausedAt = nowIso()
    res.json(todaySession(state, req.user.id))
  })

  r.post('/study/resume', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const pausedDays = s.pausedAt ? Math.max(1, Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 86400000)) : 0
    s.pausedUntil = null
    s.pausedAt = null
    const before = todaySession(state, req.user.id)
    let summary = null
    if (pausedDays >= 3) {
      s.planAdjustments = Object.fromEntries(before.plan.map((p) => [p.deckId, Math.max(1, Math.ceil(p.available / 2))]))
      const after = todaySession(state, req.user.id)
      summary = { pausedDays, cardsWaiting: before.cardsDue, cardsToday: after.cardsDue, decks: before.plan.map((p) => p.deckName), message: `Você ficou ${pausedDays} dias fora. ${before.cardsDue} cards esperam por você em ${before.plan.length} decks. Vamos com calma: deixei ${after.cardsDue} para hoje, metade de cada deck.` }
    }
    res.json({ session: todaySession(state, req.user.id), summary })
  })

  r.patch('/study/goal', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const goal = Number(req.body?.goal)
    if (!Number.isInteger(goal) || goal < 5 || goal > 200) return fail(res, 422, 'validation', 'A meta vai de 5 a 200 cards por dia.')
    s.goal = goal
    res.json(todaySession(state, req.user.id))
  })

  r.patch('/study/plan', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    if (Array.isArray(req.body?.order)) s.planOrder = req.body.order
    if (req.body?.adjustments && typeof req.body.adjustments === 'object') s.planAdjustments = { ...s.planAdjustments, ...req.body.adjustments }
    if (req.body?.reset) s.planAdjustments = {}
    res.json(todaySession(state, req.user.id))
  })

  r.post('/study/fatigue', requireStudent, (req, res) => {
    const state = req.store.state
    const s = ensureDay(state, req.user.id)
    const tz = userTimezone(state, req.user.id)
    if (req.body?.keepLoad) s.fatigueKeepLoadDay = dayKey(nowIso(), tz)
    if (typeof req.body?.enabled === 'boolean') s.fatigueDetection = req.body.enabled
    appendAudit(state, { actor: 'noa', actorRole: 'agent', action: 'reduce_load', target: req.user.id, details: { keptLoad: Boolean(req.body?.keepLoad) } })
    res.json({ fatigueDetection: s.fatigueDetection, keepLoadToday: s.fatigueKeepLoadDay === dayKey(nowIso(), tz) })
  })

  r.get('/study/history', requireStudent, (req, res) => {
    const state = req.store.state
    const byDeck = new Map()
    for (const rv of state.reviews.filter((x) => x.userId === req.user.id)) {
      const own = state.cards.find((c) => c.id === rv.cardId)
      const deckId = own ? own.deckId : rv.cardId.split('_')[0]
      const entry = byDeck.get(deckId) || { deckId, reviews: 0, lastAt: null }
      entry.reviews += 1
      if (!entry.lastAt || rv.reviewedAt > entry.lastAt) entry.lastAt = rv.reviewedAt
      byDeck.set(deckId, entry)
    }
    for (const d of ownDecksOf(state, req.user.id)) {
      if (d.lastStudiedAt) {
        const entry = byDeck.get(d.id) || { deckId: d.id, reviews: 0, lastAt: null }
        if (!entry.lastAt || d.lastStudiedAt > entry.lastAt) entry.lastAt = d.lastStudiedAt
        byDeck.set(d.id, entry)
      }
    }
    const items = Array.from(byDeck.values())
      .map((e) => {
        const own = state.decks.find((d) => d.id === e.deckId)
        const community = state.community.decks.find((d) => d.id === e.deckId)
        if (!own && !community) return null
        return { ...e, kind: own ? 'own' : 'community', name: (own || community).name, authorName: community ? state.community.authors.find((a) => a.id === community.authorId)?.name : null, categoryId: (own || community).categoryId, deleted: Boolean(own?.deletedAt) }
      })
      .filter(Boolean)
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
    res.json({ items, created: ownDecksOf(state, req.user.id).map((d) => ({ deckId: d.id, name: d.name, createdAt: d.createdAt, source: d.source?.type })) })
  })

  r.get('/study/mistakes', requireStudent, (req, res) => {
    const state = req.store.state
    const decks = ownDecksOf(state, req.user.id)
    const items = state.cards
      .filter((c) => decks.some((d) => d.id === c.deckId) && (c.sched?.lapses || 0) > 0)
      .sort((a, b) => (b.sched.lapses || 0) - (a.sched.lapses || 0))
      .slice(0, 8)
      .map((c) => ({ cardId: c.id, front: c.front, lapses: c.sched.lapses, deckId: c.deckId, deckName: decks.find((d) => d.id === c.deckId)?.name }))
    const worstDeck = items[0]?.deckId ? decks.find((d) => d.id === items[0].deckId) : null
    res.json({ items, reinforcement: worstDeck ? { deckId: worstDeck.id, deckName: worstDeck.name, suggestion: `Um deck curto de reforço em "${worstDeck.name}" com os ${items.filter((i) => i.deckId === worstDeck.id).length} cards que você mais erra.` } : null })
  })

  r.get('/objectives', requireStudent, (req, res) => {
    const state = req.store.state
    const today = dayKey(nowIso(), userTimezone(state, req.user.id))
    const objectives = state.objectives
      .filter((o) => o.userId === req.user.id)
      .map((o) => ({ ...o, daysLeft: Math.round((new Date(o.date) - new Date(today)) / 86400000), past: o.date < today }))
      .sort((a, b) => a.date.localeCompare(b.date))
    res.json({ objectives })
  })

  r.post('/objectives', requireStudent, (req, res) => {
    const state = req.store.state
    const { name, date, subjects } = req.body || {}
    if (!name || !date) return fail(res, 422, 'validation', 'Nome e data são obrigatórios.')
    const objective = { id: id('obj'), userId: req.user.id, name: name.trim(), date, subjects: subjects?.length ? subjects : inferSubjects(state, req.user.id, name), outcome: null, outcomeRewarded: false, createdAt: nowIso() }
    state.objectives.push(objective)
    const sameDate = state.objectives.filter((o) => o.userId === req.user.id && o.date === date)
    res.status(201).json({ objective, tie: sameDate.length > 1 ? sameDate.map((o) => ({ id: o.id, name: o.name })) : null })
  })

  r.patch('/objectives/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const objective = state.objectives.find((o) => o.id === req.params.id && o.userId === req.user.id)
    if (!objective) return fail(res, 404, 'not_found', 'Objetivo não encontrado.')
    const { name, date, subjects, priority } = req.body || {}
    if (name) objective.name = name
    if (date) objective.date = date
    if (subjects) objective.subjects = subjects
    if (typeof priority === 'boolean') objective.priority = priority
    res.json({ objective })
  })

  r.delete('/objectives/:id', requireStudent, (req, res) => {
    const state = req.store.state
    state.objectives = state.objectives.filter((o) => !(o.id === req.params.id && o.userId === req.user.id))
    res.json({ ok: true })
  })

  r.post('/objectives/:id/outcome', requireStudent, (req, res) => {
    const state = req.store.state
    const objective = state.objectives.find((o) => o.id === req.params.id && o.userId === req.user.id)
    if (!objective) return fail(res, 404, 'not_found', 'Objetivo não encontrado.')
    const { outcome } = req.body || {}
    if (!['aprovado', 'reprovado', 'aguardando', 'nao_fiz'].includes(outcome)) return fail(res, 422, 'validation', 'Resultado inválido.')
    objective.outcome = outcome
    objective.outcomeAt = nowIso()
    let reward = null
    if (!objective.outcomeRewarded && req.user.verified?.email && req.user.verified?.phone) {
      objective.outcomeRewarded = true
      reward = credit(state, req.user.id, 5, 'objective_outcome', { objectiveId: objective.id, name: objective.name })
    }
    const badge = outcome === 'aprovado' ? { label: `Aprovado ${objective.name} ${objective.date.slice(0, 4)}`, status: 'pendente_confirmacao', note: 'Envie o comprovante para o moderador confirmar. O documento é apagado em 24 h após a validação.' } : null
    res.json({ objective, reward, badge, balance: balanceOf(state, req.user.id) })
  })

  return r
}
