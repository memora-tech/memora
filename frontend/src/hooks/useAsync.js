import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync(fn, deps = [], { immediate = true, initial = null } = {}) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const alive = useRef(true)

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      if (alive.current) setData(result)
      return result
    } catch (err) {
      if (alive.current) setError(err)
      throw err
    } finally {
      if (alive.current) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    alive.current = true
    if (immediate) run().catch(() => {})
    return () => {
      alive.current = false
    }
  }, [run, immediate])

  return { data, error, loading, run, setData }
}
