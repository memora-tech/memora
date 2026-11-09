import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useT } from '../../i18n/index.js'
import { clearAdminSession, getAdminUser, sectionsFor } from './adminSession.js'
import { PanelShell } from '../shared/PanelShell.jsx'

export const SECTION_GROUP = {
  moderacao: 'trust',
  denuncias: 'trust',
  contestacoes: 'trust',
  suporte: 'care',
  comercial: 'business',
  financeiro: 'business',
  compliance: 'platform',
  engenharia: 'platform',
  equipe: 'org'
}

const GROUP_ORDER = ['trust', 'care', 'business', 'platform', 'org']

export function AdminLayout() {
  const t = useT()
  const navigate = useNavigate()
  const user = getAdminUser()
  const sections = sectionsFor(user?.role)

  const logout = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: t(`admin.shell.groups.${key}`),
    items: sections.filter((s) => SECTION_GROUP[s.key] === key).map((s) => ({ key: s.key, to: `/admin/painel/${s.key}`, label: t(`admin.nav.${s.key}`), icon: s.icon, end: s.key !== 'moderacao' }))
  })).filter((g) => g.items.length)

  const meta = user ? [t(`admin.roles.${user.role}`), user.areas?.length ? user.areas.join(', ') : null].filter(Boolean).join(' · ') : null

  return (
    <PanelShell product={t('admin.name')} home="/admin/painel" groups={groups} user={user ? { name: user.name, meta } : null} onLogout={logout} labels={{ nav: t('admin.nav.label'), skip: t('admin.shell.skip'), menu: t('admin.shell.menu'), close: t('admin.shell.close'), logout: t('admin.header.logout') }}>
      <Outlet />
    </PanelShell>
  )
}

export function AdminHome() {
  const user = getAdminUser()
  const first = sectionsFor(user?.role)[0]
  return <Navigate to={first ? first.key : '/admin/login'} replace />
}

export function useSectionEyebrow(key) {
  const t = useT()
  return t(`admin.shell.groups.${SECTION_GROUP[key]}`)
}
