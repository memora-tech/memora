import { createApp } from '../../../backend/src/app.js'
import { createStore } from '../../../backend/src/store.js'

export async function startLiveServer(profile = 'adult-free') {
  const store = createStore(profile)
  const app = createApp(store)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    const target = url.startsWith('/') ? `${base}${url}` : url
    return originalFetch(target, init)
  }
  return {
    store,
    base,
    async login() {
      const res = await originalFetch(`${base}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google' }) })
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
