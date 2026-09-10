import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setSimulatedOffline, studentApi } from '../lib/api.js'
import { storage } from '../lib/storage.js'

const KEY = 'memora.proto'

const defaults = { offline: false, nextGeneration: 'normal', barOpen: false, fatigueTrigger: 0, notification: null, lastAction: null }

const ProtoContext = createContext(null)

export function ProtoProvider({ children }) {
  const [state, setState] = useState(() => ({ ...defaults, ...storage.get(KEY, {}), notification: null, barOpen: false }))
  const [server, setServer] = useState(null)

  useEffect(() => {
    storage.set(KEY, { offline: state.offline, nextGeneration: state.nextGeneration })
    setSimulatedOffline(state.offline)
  }, [state.offline, state.nextGeneration])

  const refreshServer = useCallback(async () => {
    try {
      const data = await studentApi.get('/_proto/state', { allowOffline: true })
      setServer(data)
      return data
    } catch {
      return null
    }
  }, [])

  const setOffline = useCallback((offline) => setState((s) => ({ ...s, offline })), [])
  const setBarOpen = useCallback((barOpen) => setState((s) => ({ ...s, barOpen })), [])
  const setNextGeneration = useCallback((nextGeneration) => setState((s) => ({ ...s, nextGeneration })), [])
  const consumeNextGeneration = useCallback(() => {
    const current = state.nextGeneration
    if (current !== 'normal') setState((s) => ({ ...s, nextGeneration: 'normal' }))
    return current
  }, [state.nextGeneration])
  const simulateFatigue = useCallback(() => setState((s) => ({ ...s, fatigueTrigger: s.fatigueTrigger + 1 })), [])
  const dismissNotification = useCallback(() => setState((s) => ({ ...s, notification: null })), [])

  const triggerNotification = useCallback(async (channel, force = false) => {
    const data = await studentApi.post('/_proto/notification', { channel, force }, { allowOffline: true })
    setState((s) => ({ ...s, notification: data.delivered ? data.notification : { undelivered: true, reason: data.reason, channel } }))
    return data
  }, [])

  const setProfile = useCallback(
    async (profile) => {
      await studentApi.post('/_proto/profile', { profile }, { allowOffline: true })
      await refreshServer()
      window.dispatchEvent(new CustomEvent('memora:proto-changed', { detail: { profile } }))
    },
    [refreshServer]
  )

  const setCouponAvailable = useCallback(
    async (available) => {
      await studentApi.post('/_proto/coupon-available', { available }, { allowOffline: true })
      await refreshServer()
      window.dispatchEvent(new CustomEvent('memora:proto-changed', { detail: { couponAvailable: available } }))
    },
    [refreshServer]
  )

  const reset = useCallback(async () => {
    await studentApi.post('/_proto/reset', { profile: 'adult-free' }, { allowOffline: true })
    storage.remove(KEY)
    storage.remove('memora.offline.reviews')
    storage.remove('memora.cache.today')
    storage.remove('memora.cache.decks')
    window.location.assign('/app')
  }, [])

  const value = useMemo(
    () => ({ ...state, server, refreshServer, setOffline, setBarOpen, setNextGeneration, consumeNextGeneration, simulateFatigue, triggerNotification, dismissNotification, setProfile, setCouponAvailable, reset }),
    [state, server, refreshServer, setOffline, setBarOpen, setNextGeneration, consumeNextGeneration, simulateFatigue, triggerNotification, dismissNotification, setProfile, setCouponAvailable, reset]
  )

  return <ProtoContext.Provider value={value}>{children}</ProtoContext.Provider>
}

export function useProto() {
  const ctx = useContext(ProtoContext)
  if (!ctx) throw new Error('useProto fora do ProtoProvider')
  return ctx
}
