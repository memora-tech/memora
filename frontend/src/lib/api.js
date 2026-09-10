import { storage } from './storage.js'

export class ApiError extends Error {
  constructor(status, body = {}) {
    super(body.message || (status === 0 ? 'Sem conexão.' : `Erro ${status}`))
    this.status = status
    this.code = body.code || (status === 0 ? 'offline' : 'error')
    this.body = body
  }
}

const listeners = new Set()
let simulatedOffline = false

export function setSimulatedOffline(value) {
  simulatedOffline = Boolean(value)
  listeners.forEach((fn) => fn(isOffline()))
}

export function isOffline() {
  return simulatedOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)
}

export function onConnectivity(fn) {
  listeners.add(fn)
  const handler = () => fn(isOffline())
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}

export function createClient(scope) {
  const tokenKey = `memora.token.${scope}`
  const client = {
    scope,
    getToken: () => storage.get(tokenKey),
    setToken: (token) => (token ? storage.set(tokenKey, token) : storage.remove(tokenKey)),
    async request(path, { method = 'GET', body, headers = {}, allowOffline = false } = {}) {
      if (isOffline() && !allowOffline) throw new ApiError(0, { code: 'offline', message: 'Você está offline.' })
      const token = client.getToken()
      let res
      try {
        res = await fetch(`/v1${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
          body: body === undefined ? undefined : JSON.stringify(body)
        })
      } catch {
        throw new ApiError(0, { code: 'offline', message: 'Não foi possível falar com o servidor.' })
      }
      const data = res.status === 204 ? null : await res.json().catch(() => null)
      if (!res.ok) throw new ApiError(res.status, data || {})
      return data
    },
    get: (path, opts) => client.request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => client.request(path, { ...opts, method: 'POST', body: body ?? {} }),
    patch: (path, body, opts) => client.request(path, { ...opts, method: 'PATCH', body: body ?? {} }),
    del: (path, opts) => client.request(path, { ...opts, method: 'DELETE' })
  }
  return client
}

export const studentApi = createClient('student')
export const parentalApi = createClient('parental')
export const b2bApi = createClient('b2b')
export const adminApi = createClient('admin')
export const partnerApi = createClient('partner')
export const publicApi = createClient('public')
