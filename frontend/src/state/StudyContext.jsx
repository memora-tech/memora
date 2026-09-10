import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { studentApi, ApiError, isOffline, onConnectivity } from '../lib/api.js'
import { storage } from '../lib/storage.js'
import { enqueueReview, flushReviews, pendingReviews } from '../lib/offlineQueue.js'
import { uid } from '../lib/ids.js'
import { useSession } from './SessionContext.jsx'

const CACHE_KEY = 'memora.cache.today'
const CHROME_MS = 4000
const RATING_OK = new Set(['good', 'easy'])

const initial = {
  today: null,
  loading: true,
  error: null,
  cached: false,
  active: null,
  chromeVisible: false,
  catalog: null,
  pendingCount: pendingReviews().length,
  lastSummary: null
}

function reducer(state, action) {
  switch (action.type) {
    case 'today-loading':
      return { ...state, loading: true, error: null }
    case 'today':
      return { ...state, today: action.today, loading: false, error: null, cached: Boolean(action.cached) }
    case 'today-error':
      return { ...state, loading: false, error: action.error }
    case 'catalog':
      return { ...state, catalog: action.catalog }
    case 'start':
      return { ...state, active: action.active, chromeVisible: false }
    case 'flip':
      return state.active ? { ...state, active: { ...state.active, flipped: !state.active.flipped } } : state
    case 'answer': {
      const a = state.active
      if (!a) return state
      const answers = [...a.answers, action.answer]
      let queue = a.queue
      if (action.answer.rating === 'again' && action.answer.card.type !== 'noa') {
        const reinsertAt = Math.min(queue.length, a.index + 4)
        queue = [...queue.slice(0, reinsertAt), { ...action.answer.card, relearn: true }, ...queue.slice(reinsertAt)]
      }
      return { ...state, active: { ...a, answers, queue, index: a.index + 1, flipped: false, shownAt: Date.now(), reduced: action.reduced ?? a.reduced, fatigueSignals: action.fatigueSignals ?? a.fatigueSignals } }
    }
    case 'noa-done': {
      const a = state.active
      if (!a) return state
      return { ...state, active: { ...a, index: a.index + 1, flipped: false, shownAt: Date.now(), noaResolved: true } }
    }
    case 'reduce': {
      const a = state.active
      if (!a) return state
      const remaining = a.queue.length - a.index
      const keep = Math.max(1, Math.ceil(remaining / 2))
      return { ...state, active: { ...a, reduced: true, fatigueSignals: action.signals, queue: [...a.queue.slice(0, a.index + keep)], removed: remaining - keep } }
    }
    case 'keep-load': {
      const a = state.active
      if (!a) return state
      return { ...state, active: { ...a, reduced: false, keptLoad: true, queue: a.fullQueue } }
    }
    case 'translation':
      return state.active ? { ...state, active: { ...state.active, translation: { ...state.active.translation, ...action.patch } } } : state
    case 'chrome':
      return { ...state, chromeVisible: action.visible }
    case 'end':
      return { ...state, active: null, chromeVisible: false, lastSummary: action.summary ?? state.lastSummary }
    case 'pending':
      return { ...state, pendingCount: action.count }
    default:
      return state
  }
}

const StudyContext = createContext(null)

function buildQueue(cards, suggestion) {
  const queue = cards.map((c) => ({ ...c }))
  if (suggestion && queue.length > 0) {
    const at = Math.min(queue.length, suggestion.showAfterCard ?? 5)
    queue.splice(at, 0, { id: `noa_${suggestion.id}`, type: 'noa', suggestion })
  }
  return queue
}

function detectFatigue(answers, startedAt, signals, personal) {
  const real = answers.filter((a) => a.card.type !== 'noa')
  const out = { slow: false, errors: false, long: false }
  const avg = (list) => list.reduce((n, a) => n + (a.durationMs || 0), 0) / Math.max(1, list.length)
  const errRate = (list) => list.filter((a) => a.rating === 'again').length / Math.max(1, list.length)
  const hasPersonal = personal && personal.sample >= 5
  const minAnswers = hasPersonal ? 5 : 10
  if (real.length >= minAnswers) {
    const recent = real.slice(-5)
    const earlier = real.slice(0, -5)
    const baseAvg = hasPersonal ? personal.avgMs : avg(earlier)
    const baseErr = hasPersonal ? personal.errorRate : errRate(earlier)
    if (baseAvg > 0 && avg(recent) > baseAvg * signals.responseTimeFactor) out.slow = true
    if (baseErr > 0 && errRate(recent) > baseErr * signals.errorRateFactor) out.errors = true
  }
  if (Date.now() - startedAt > signals.sessionMinutes * 60000) out.long = true
  return out
}

export function StudyProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const session = useSession()
  const chromeTimer = useRef(null)
  const activeRef = useRef(null)
  activeRef.current = state.active

  const loadToday = useCallback(async () => {
    if (!session.isAuthed) return null
    dispatch({ type: 'today-loading' })
    try {
      const today = await studentApi.get('/study/today')
      storage.set(CACHE_KEY, today)
      dispatch({ type: 'today', today })
      return today
    } catch (err) {
      const cached = storage.get(CACHE_KEY)
      if (cached && (err.code === 'offline' || err.status === 0)) {
        const available = new Set(cached.offline?.recentDeckIds || [])
        const cards = cached.cards.filter((c) => available.has(c.deckId))
        const today = { ...cached, cards, cardsDue: cards.length, estimatedMinutes: Math.max(1, Math.ceil((cards.length * 20) / 60)), plan: cached.plan.filter((p) => available.has(p.deckId)) }
        dispatch({ type: 'today', today, cached: true })
        return today
      }
      dispatch({ type: 'today-error', error: err })
      return null
    }
  }, [session.isAuthed])

  useEffect(() => {
    if (session.isAuthed) loadToday()
  }, [session.isAuthed, session.user?.plan, session.user?.isMinor, loadToday])

  useEffect(() => {
    if (!session.isAuthed || state.catalog) return
    studentApi
      .get('/noa/catalog')
      .then((catalog) => dispatch({ type: 'catalog', catalog }))
      .catch(() => {})
  }, [session.isAuthed, state.catalog])

  useEffect(() => {
    const unsubscribe = onConnectivity(async (offline) => {
      if (offline) return
      if (pendingReviews().length) {
        try {
          const { flushed } = await flushReviews()
          dispatch({ type: 'pending', count: 0 })
          window.dispatchEvent(new CustomEvent('memora:synced', { detail: { flushed } }))
          await loadToday()
          await session.refresh()
        } catch {
          return undefined
        }
      }
      return undefined
    })
    return unsubscribe
  }, [loadToday, session])

  const sendReview = useCallback(
    async (review) => {
      if (isOffline()) {
        const count = enqueueReview(review)
        dispatch({ type: 'pending', count })
        return { queued: true }
      }
      try {
        const result = await studentApi.post('/reviews', { reviews: [review] })
        if (result.rewards?.length) window.dispatchEvent(new CustomEvent('memora:reward', { detail: { rewards: result.rewards, balance: result.balance } }))
        return result
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          const count = enqueueReview(review)
          dispatch({ type: 'pending', count })
          return { queued: true }
        }
        throw err
      }
    },
    []
  )

  const start = useCallback(
    ({ mode = 'today', deckId = null, deckName = null, cards = null, translationAvailable = false, lang = 'pt-BR' } = {}) => {
      const source = cards || state.today?.cards || []
      if (!source.length) return false
      const suggestion = mode === 'today' && state.today?.noaSuggestion && state.today.noaSuggestion.status === 'pendente' ? state.today.noaSuggestion : null
      const queue = buildQueue(source, suggestion)
      dispatch({
        type: 'start',
        active: {
          mode,
          deckId,
          deckName: deckName || (mode === 'today' ? null : source[0]?.deckName || null),
          queue,
          fullQueue: queue,
          index: 0,
          flipped: false,
          answers: [],
          startedAt: Date.now(),
          shownAt: Date.now(),
          reduced: false,
          keptLoad: Boolean(state.today?.fatigue?.keepLoadToday),
          fatigueSignals: null,
          noaResolved: false,
          translation: { available: translationAvailable, on: false, lang, from: source[0]?.lang || 'pt-BR' },
          total: queue.filter((c) => c.type !== 'noa').length
        }
      })
      return true
    },
    [state.today]
  )

  const flip = useCallback(() => dispatch({ type: 'flip' }), [])

  const rate = useCallback(
    async (rating) => {
      const a = activeRef.current
      if (!a) return
      const card = a.queue[a.index]
      if (!card || card.type === 'noa') return
      const durationMs = Date.now() - a.shownAt
      const answer = { card, rating, durationMs, at: new Date().toISOString() }
      const signalsCfg = state.today?.fatigue?.signals || { responseTimeFactor: 2, errorRateFactor: 1.5, sessionMinutes: 45, required: 2 }
      const detectionOn = state.today?.fatigue?.enabled !== false && !a.keptLoad && !a.reduced
      const signals = detectFatigue([...a.answers, answer], a.startedAt, signalsCfg, state.today?.fatigue?.personal)
      const activeCount = Object.values(signals).filter(Boolean).length
      dispatch({ type: 'answer', answer })
      if (detectionOn && activeCount >= (signalsCfg.required || 2)) dispatch({ type: 'reduce', signals })
      sendReview({ clientId: uid('rv'), cardId: card.id, rating, reviewedAt: answer.at, durationMs }).catch(() => {})
    },
    [sendReview, state.today]
  )

  const forceFatigue = useCallback(() => {
    const a = activeRef.current
    if (!a || a.reduced || a.keptLoad) return false
    dispatch({ type: 'reduce', signals: { slow: true, errors: true, long: false, simulated: true } })
    return true
  }, [])

  const keepLoad = useCallback(async () => {
    dispatch({ type: 'keep-load' })
    try {
      await studentApi.post('/study/fatigue', { keepLoad: true })
    } catch {
      return undefined
    }
    return undefined
  }, [])

  const respondNoa = useCallback(async (accepted, feedback) => {
    const a = activeRef.current
    const card = a?.queue[a.index]
    if (!card || card.type !== 'noa') return null
    dispatch({ type: 'noa-done' })
    try {
      const result = await studentApi.post(`/noa/suggestions/${card.suggestion.id}/respond`, { accepted, feedback })
      return result
    } catch {
      return null
    }
  }, [])

  const setTranslation = useCallback((patch) => dispatch({ type: 'translation', patch }), [])

  const revealChrome = useCallback(() => {
    dispatch({ type: 'chrome', visible: true })
    if (chromeTimer.current) clearTimeout(chromeTimer.current)
    chromeTimer.current = setTimeout(() => dispatch({ type: 'chrome', visible: false }), CHROME_MS)
  }, [])

  useEffect(() => {
    if (state.chromeVisible) {
      dispatch({ type: 'chrome', visible: false })
      if (chromeTimer.current) clearTimeout(chromeTimer.current)
    }
  }, [state.active?.index])

  const complete = useCallback(async () => {
    const a = activeRef.current
    let summary = null
    try {
      summary = await studentApi.post('/study/complete')
    } catch {
      summary = null
    }
    const answers = a?.answers.filter((x) => x.card.type !== 'noa') || []
    const local = {
      cardsReviewed: answers.length,
      accuracy: answers.length ? Math.round((answers.filter((x) => RATING_OK.has(x.rating)).length / answers.length) * 100) : null,
      mode: a?.mode,
      deckName: a?.deckName,
      reduced: a?.reduced,
      offline: isOffline()
    }
    const merged = { ...local, ...(summary || {}), local }
    dispatch({ type: 'end', summary: merged })
    await loadToday()
    session.refresh().catch(() => {})
    return merged
  }, [loadToday, session])

  const exit = useCallback(() => dispatch({ type: 'end' }), [])

  const mutateToday = useCallback(async (fn) => {
    const today = await fn()
    if (today?.date) {
      storage.set(CACHE_KEY, today)
      dispatch({ type: 'today', today })
    }
    return today
  }, [])

  const skipToday = useCallback(() => mutateToday(() => studentApi.post('/study/skip')), [mutateToday])
  const undoSkip = useCallback(() => mutateToday(() => studentApi.post('/study/undo-skip')), [mutateToday])
  const pause = useCallback((days) => mutateToday(() => studentApi.post('/study/pause', { days })), [mutateToday])
  const resume = useCallback(async () => {
    const data = await studentApi.post('/study/resume')
    if (data.session) {
      storage.set(CACHE_KEY, data.session)
      dispatch({ type: 'today', today: data.session })
    }
    return data
  }, [])
  const setGoal = useCallback((goal) => mutateToday(() => studentApi.patch('/study/goal', { goal })), [mutateToday])
  const updatePlan = useCallback((patch) => mutateToday(() => studentApi.patch('/study/plan', patch)), [mutateToday])

  const value = useMemo(
    () => ({ ...state, focus: Boolean(state.active), loadToday, start, flip, rate, respondNoa, keepLoad, forceFatigue, setTranslation, revealChrome, complete, exit, skipToday, undoSkip, pause, resume, setGoal, updatePlan }),
    [state, loadToday, start, flip, rate, respondNoa, keepLoad, forceFatigue, setTranslation, revealChrome, complete, exit, skipToday, undoSkip, pause, resume, setGoal, updatePlan]
  )

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy fora do StudyProvider')
  return ctx
}
