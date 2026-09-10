import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { b2bApi, ApiError } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'

const USER_KEY = 'memora.b2b.user'

export function saveB2BUser(user) {
  storage.set(USER_KEY, user)
}

export function getB2BUser() {
  return storage.get(USER_KEY)
}

export function clearB2BSession() {
  b2bApi.setToken(null)
  storage.remove(USER_KEY)
}

export function useB2BGuard() {
  const navigate = useNavigate()
  return useCallback(
    (err) => {
      if (err instanceof ApiError && err.status === 401) {
        clearB2BSession()
        navigate('/b2b/login', { replace: true })
        return true
      }
      return false
    },
    [navigate]
  )
}
