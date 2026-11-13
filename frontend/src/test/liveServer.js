import { createApp } from '../../../backend/src/app.js'
import { createStore } from '../../../backend/src/store.js'

export async function startLiveServer(profile = 'adult-free', options = {}) {
  const store = createStore(profile)
  const app = createApp(store, options)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  const originalFetch = globalThis.fetch
  const calls = []
  const notFoundCalls = []
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    const target = url.startsWith('/') ? `${base}${url}` : url
    const res = await originalFetch(target, init)
    calls.push({ url, status: res.status })
    if (res.status === 404) notFoundCalls.push(url)
    return res
  }
  return {
    store,
    base,
    calls,
    notFoundCalls,
    async login() {
      const res = await originalFetch(`${base}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'email', email: 'manoel@exemplo.com', password: 'senha-segura' })
      })
      const data = await res.json()
      window.localStorage.setItem('memora.token.student', JSON.stringify(data.token))
      return data
    },
    async close() {
      globalThis.fetch = originalFetch
      await new Promise((resolve) => server.close(resolve))
    }
  }
}
