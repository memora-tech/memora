import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { studentApi, ApiError } from '../lib/api.js'
import { storage } from '../lib/storage.js'

const CACHE_KEY = 'memora.cache.me'

const initial = { status: 'loading', user: null, notifications: null, consents: null, subscription: null, dailyCredit: null, cached: false, flow: null }

function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...state, status: 'authed', user: action.user, notifications: action.notifications ?? state.notifications, consents: action.consents ?? state.consents, subscription: action.subscription ?? state.subscription, dailyCredit: action.dailyCredit ?? null, cached: Boolean(action.cached) }
    case 'user':
      return { ...state, user: action.user, status: 'authed' }
    case 'patch':
      return { ...state, ...action.patch }
    case 'anon':
      return { ...initial, status: 'anon' }
    case 'credit-seen':
      return { ...state, dailyCredit: null }
    default:
      return state
  }
}

const SessionContext = createContext(null)

function applyAccessibility(user) {
  const a11y = user?.settings?.accessibility || {}
  const root = document.documentElement
  if (a11y.reduceMotion) root.setAttribute('data-reduce-motion', 'true')
  else root.removeAttribute('data-reduce-motion')
  if (a11y.largeText) root.setAttribute('data-text-size', 'large')
  else root.removeAttribute('data-text-size')
}

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const refresh = useCallback(async () => {
    if (!studentApi.getToken()) {
      dispatch({ type: 'anon' })
      return null
    }
    try {
      const data = await studentApi.get('/me')
      storage.set(CACHE_KEY, data)
      applyAccessibility(data.user)
      dispatch({ type: 'loaded', ...data })
      return data
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        studentApi.setToken(null)
        storage.remove(CACHE_KEY)
        dispatch({ type: 'anon' })
        return null
      }
      const cached = storage.get(CACHE_KEY)
      if (cached?.user) {
        applyAccessibility(cached.user)
        dispatch({ type: 'loaded', ...cached, dailyCredit: null, cached: true })
        return cached
      }
      dispatch({ type: 'anon' })
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('memora:proto-changed', handler)
    return () => window.removeEventListener('memora:proto-changed', handler)
  }, [refresh])

  const login = useCallback(
    async (payload) => {
      const data = await studentApi.post('/auth/login', payload)
      studentApi.setToken(data.token)
      dispatch({ type: 'patch', patch: { flow: 'login' } })
      await refresh()
      return data
    },
    [refresh]
  )

  const register = useCallback(async (payload) => {
    const data = await studentApi.post('/auth/register', payload)
    studentApi.setToken(data.token)
    dispatch({ type: 'loaded', user: data.user })
    dispatch({ type: 'patch', patch: { flow: 'register', registration: data } })
    return data
  }, [])

  const confirm = useCallback(async (channel, code) => {
    const data = await studentApi.post('/auth/confirm', { channel, code })
    dispatch({ type: 'user', user: data.user })
    return data
  }, [])

  const resendCode = useCallback((channel) => studentApi.post('/auth/resend', { channel }), [])

  const verifyAge = useCallback(async (payload) => {
    const data = await studentApi.post('/auth/age-verification', payload)
    if (data.user) dispatch({ type: 'user', user: data.user })
    return data
  }, [])

  const completeOnboarding = useCallback(
    async (payload) => {
      const data = await studentApi.post('/auth/onboarding', payload)
      await refresh()
      return data
    },
    [refresh]
  )

  const logout = useCallback(async () => {
    try {
      await studentApi.post('/auth/logout')
    } catch {
      return undefined
    } finally {
      studentApi.setToken(null)
      storage.remove(CACHE_KEY)
      dispatch({ type: 'anon' })
    }
    return undefined
  }, [])

  const updateSettings = useCallback(async (patch) => {
    const data = await studentApi.patch('/me/settings', patch)
    applyAccessibility(data.user)
    dispatch({ type: 'patch', patch: { user: data.user, notifications: data.notifications } })
    return data
  }, [])

  const updateConsents = useCallback(async (patch) => {
    const data = await studentApi.patch('/me/consents', patch)
    dispatch({ type: 'patch', patch: { consents: data.consents } })
    return data
  }, [])

  const setUser = useCallback((user) => dispatch({ type: 'user', user }), [])
  const markCreditSeen = useCallback(() => dispatch({ type: 'credit-seen' }), [])

  const value = useMemo(
    () => ({ ...state, isAuthed: state.status === 'authed', isMinor: Boolean(state.user?.isMinor), plan: state.user?.plan || 'free', canEarn: Boolean(state.user?.canEarn), refresh, login, register, confirm, resendCode, verifyAge, completeOnboarding, logout, updateSettings, updateConsents, setUser, markCreditSeen }),
    [state, refresh, login, register, confirm, resendCode, verifyAge, completeOnboarding, logout, updateSettings, updateConsents, setUser, markCreditSeen]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession fora do SessionProvider')
  return ctx
}
