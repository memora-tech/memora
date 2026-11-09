import { useLocation, useNavigate } from 'react-router-dom'
import styles from './b2b.module.css'
import { Button, Chip, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDate } from '../../lib/format.js'
import { clearB2BSession, getB2BUser } from './b2bSession.js'
import { PanelShell, PanelEmpty } from '../shared/PanelShell.jsx'

export const B2B_TABS = [
  { value: 'classes', slug: 'turmas', icon: 'school' },
  { value: 'invites', slug: 'convites', icon: 'mail' },
  { value: 'indicators', slug: 'indicadores', icon: 'chart' },
  { value: 'users', slug: 'usuarios', icon: 'users' }
]

export function tabFromSearch(search) {
  const slug = new URLSearchParams(search).get('aba')
  return B2B_TABS.find((x) => x.slug === slug)?.value || 'classes'
}

export function B2BShell({ overview, children }) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const user = overview?.me || getB2BUser()
  const tenantName = overview?.tenant?.name || user?.tenantName
  const onDashboard = location.pathname.replace(/\/$/, '') === '/b2b/painel'
  const current = onDashboard ? tabFromSearch(location.search) : 'classes'

  const logout = () => {
    clearB2BSession()
    navigate('/b2b/login', { replace: true })
  }

  const counts = { classes: overview?.classes?.length, invites: overview?.invites?.length }

  const groups = [
    {
      key: 'institution',
      label: t('b2b.shell.groups.institution'),
      items: B2B_TABS.map((tab) => ({
        key: tab.value,
        to: tab.value === 'classes' ? '/b2b/painel' : `/b2b/painel?aba=${tab.slug}`,
        label: t(`b2b.nav.${tab.value}`),
        icon: tab.icon,
        active: current === tab.value,
        count: counts[tab.value] || undefined
      }))
    }
  ]

  const meta = user ? [t(`b2b.login.roles.${user.role}`), tenantName].filter(Boolean).join(' · ') : null

  return (
    <PanelShell product={t('b2b.name')} home="/b2b/painel" groups={groups} user={user ? { name: user.name, meta } : null} onLogout={logout} labels={{ nav: t('b2b.nav.label'), skip: t('b2b.shell.skip'), menu: t('b2b.shell.menu'), close: t('b2b.shell.close'), logout: t('b2b.header.logout') }}>
      {children}
    </PanelShell>
  )
}

export function TenantFacts({ tenant }) {
  const t = useT()
  if (!tenant) return null
  return (
    <section className={styles.tenantFacts} aria-label={t('b2b.header.tenant')}>
      <Chip tone={tenant.dpa?.status === 'ativo' ? 'success' : 'warning'} icon="shield">
        {t('b2b.header.dpa')}: {t('b2b.header.dpaStatus', { version: tenant.dpa?.version, status: tenant.dpa?.status, date: fmtDate(tenant.dpa?.signedAt) })}
      </Chip>
      <Chip tone="neutral" icon="lock">
        {t('b2b.header.isolation')}: {tenant.isolation}
      </Chip>
      <Chip tone="neutral" icon="key">
        {t('b2b.header.sso')}: {tenant.sso}
      </Chip>
      <Chip tone="neutral" icon="receipt">
        {t('b2b.header.plan')}: {tenant.plan}
      </Chip>
    </section>
  )
}

export function B2BState({ loading, error, onRetry }) {
  const t = useT()
  if (loading) {
    return (
      <div className={styles.stateBox} role="status">
        <Icon name="refresh" size={24} />
        <span>{t('b2b.states.loading')}</span>
      </div>
    )
  }
  if (error) {
    const message = error.status === 403 ? t('b2b.states.forbidden') : error.code === 'offline' ? t('b2b.states.offline') : error.message || t('b2b.states.error')
    return (
      <div role="alert">
        <PanelEmpty
          icon="alert"
          title={message}
          action={
            onRetry ? (
              <Button variant="ghost" icon="refresh" onClick={onRetry}>
                {t('b2b.states.retry')}
              </Button>
            ) : null
          }
        />
      </div>
    )
  }
  return null
}
