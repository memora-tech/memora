import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, ApiError } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'
import { useAsync } from '../../hooks/useAsync.js'

const USER_KEY = 'memora.admin.user'

export const ADMIN_ROLES = ['moderador', 'suporte_n1', 'suporte_n2', 'comercial', 'financeiro', 'compliance', 'engenharia']

export const SECTIONS = [
  { key: 'moderacao', icon: 'shield', roles: ['moderador', 'compliance', 'engenharia'] },
  { key: 'denuncias', icon: 'flag', roles: ['moderador', 'compliance', 'engenharia'] },
  { key: 'contestacoes', icon: 'route', roles: ['moderador', 'compliance', 'engenharia'] },
  { key: 'suporte', icon: 'help', roles: ['suporte_n1', 'suporte_n2', 'compliance', 'engenharia'] },
  { key: 'comercial', icon: 'building', roles: ['comercial', 'engenharia'] },
  { key: 'financeiro', icon: 'receipt', roles: ['financeiro', 'engenharia'] },
  { key: 'compliance', icon: 'lock', roles: ['compliance', 'engenharia'] },
  { key: 'engenharia', icon: 'zap', roles: ['engenharia'] },
  { key: 'equipe', icon: 'users', roles: ADMIN_ROLES }
]

export function sectionsFor(role) {
  return SECTIONS.filter((s) => s.roles.includes(role))
}

export function saveAdminUser(user) {
  storage.set(USER_KEY, user)
}

export function getAdminUser() {
  return storage.get(USER_KEY)
}

export function clearAdminSession() {
  adminApi.setToken(null)
  storage.remove(USER_KEY)
}

export function useAdminGuard() {
  const navigate = useNavigate()
  return useCallback(
    (err) => {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminSession()
        navigate('/admin/login', { replace: true })
        return true
      }
      return false
    },
    [navigate]
  )
}

export function useAdminData(fn, deps = []) {
  const guard = useAdminGuard()
  return useAsync(async () => {
    try {
      return await fn()
    } catch (err) {
      if (!guard(err)) throw err
      return null
    }
  }, [guard, ...deps])
}
