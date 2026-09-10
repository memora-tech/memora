export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      return false
    }
    return true
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      return false
    }
    return true
  }
}

export const session = {
  get(key, fallback = null) {
    try {
      const raw = window.sessionStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      return false
    }
    return true
  }
}
