import { useCallback, useEffect, useState } from 'react'
import { studentApi } from '../../lib/api.js'

export const ARRIVAL_EVENT = 'memora:mcp-arrival'
const POLL_MS = 8000

export async function simulateMcpArrival(kind = 'flashcards') {
  const res = await studentApi.post('/mcp/simulate', { kind })
  window.dispatchEvent(new CustomEvent(ARRIVAL_EVENT, { detail: res }))
  return res
}

export const REQUESTS_EVENT = 'memora:mcp-requests-changed'

export function useMcpRequests() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    try {
      setData(await studentApi.get('/mcp/requests'))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener(ARRIVAL_EVENT, load)
    window.addEventListener(REQUESTS_EVENT, load)
    return () => {
      clearInterval(timer)
      window.removeEventListener(ARRIVAL_EVENT, load)
      window.removeEventListener(REQUESTS_EVENT, load)
    }
  }, [load])

  return { data, error, reload: load, pending: data?.counts?.pendente ?? 0 }
}

export async function decideRequest(id, action, body = {}) {
  const res = await studentApi.post(`/mcp/requests/${id}/${action}`, body)
  window.dispatchEvent(new CustomEvent(REQUESTS_EVENT))
  window.dispatchEvent(new CustomEvent(ARRIVAL_EVENT))
  return res
}

export function useMcpInbox() {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    try {
      const data = await studentApi.get('/mcp/inbox')
      setItems(data.items)
      setLoaded(true)
    } catch {
      return undefined
    }
    return undefined
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener(ARRIVAL_EVENT, load)
    return () => {
      clearInterval(timer)
      window.removeEventListener(ARRIVAL_EVENT, load)
    }
  }, [load])

  const dismiss = useCallback(async (id) => {
    setItems((list) => list.filter((i) => i.id !== id))
    try {
      await studentApi.post(`/mcp/inbox/${id}/seen`)
    } catch {
      return undefined
    }
    return undefined
  }, [])

  return { items, loaded, reload: load, dismiss }
}
