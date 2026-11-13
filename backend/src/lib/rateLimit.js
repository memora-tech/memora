import { fail } from './helpers.js'
import { createServiceClient, isSupabaseConfigured } from '../data/supabase.js'

export function rateLimit({
  scope,
  maxHits,
  windowSeconds,
  keyFrom = (req) => req.user?.id || req.ip || 'local',
  message = 'Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente.'
}) {
  return async (req, res, next) => {
    try {
      const actorKey = String(keyFrom(req) || 'local')
      const useSupabase = Boolean(req.useSupabase || (!req.store && isSupabaseConfigured()))

      if (useSupabase) {
        const serviceClient = req.serviceClient || createServiceClient()
        const { data, error } = await serviceClient.rpc('check_rate_limit', {
          p_scope: scope,
          p_actor_key: actorKey,
          p_max_hits: maxHits,
          p_window_seconds: windowSeconds
        })
        if (error) throw error
        if (data && data.allowed === false) {
          return fail(res, 429, 'rate_limited', message, {
            limit: maxHits,
            resetAt: data.resetAt || null
          })
        }
        return next()
      }

      if (req.store?.state) {
        const buckets = (req.store.state.rateLimits = req.store.state.rateLimits || {})
        const windowKey = Math.floor(Date.now() / (windowSeconds * 1000))
        const compositeKey = `${scope}:${actorKey}:${windowKey}`
        const current = (buckets[compositeKey] || 0) + 1
        buckets[compositeKey] = current
        if (current > maxHits) {
          return fail(res, 429, 'rate_limited', message, {
            limit: maxHits,
            resetAt: new Date((windowKey + 1) * windowSeconds * 1000).toISOString()
          })
        }
      }

      return next()
    } catch (err) {
      return next(err)
    }
  }
}

