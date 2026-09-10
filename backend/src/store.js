import { seed } from './seed/index.js'

export function createStore(profile = 'adult-free') {
  const store = {
    state: seed(profile),
    timers: new Set(),
    reset(nextProfile = 'adult-free') {
      for (const t of store.timers) clearTimeout(t)
      store.timers.clear()
      store.state = seed(nextProfile)
      return store.state
    },
    later(fn, ms) {
      const t = setTimeout(() => {
        store.timers.delete(t)
        fn()
      }, ms)
      store.timers.add(t)
      return t
    }
  }
  return store
}
