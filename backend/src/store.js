import { seed } from './seed/index.js'

export function createStore(profile = 'adult-free') {
  const store = {
    state: seed(profile),
    reset(nextProfile = 'adult-free') {
      store.state = seed(nextProfile)
      return store.state
    }
  }
  return store
}
