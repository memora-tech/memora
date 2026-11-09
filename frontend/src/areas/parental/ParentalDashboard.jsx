import { useCallback, useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { parentalApi } from '../../lib/api.js'
import { Button, Banner, Skeleton } from '../../design-system/index.js'
import { PanelShell } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { ParentalSummary } from './ParentalSummary.jsx'
import { ParentalPermissions } from './ParentalPermissions.jsx'
import { ParentalRequests } from './ParentalRequests.jsx'
import { ParentalActivity } from './ParentalActivity.jsx'
import styles from './parental.module.css'

const GROUPS = [
  {
    key: 'follow',
    items: [
      { path: '', key: 'summary', icon: 'home' },
      { path: 'atividade', key: 'activity', icon: 'clock' }
    ]
  },
  {
    key: 'control',
    items: [
      { path: 'permissoes', key: 'permissions', icon: 'shield' },
      { path: 'solicitacoes', key: 'requests', icon: 'bell' }
    ]
  }
]

export function ParentalDashboard() {
  const t = useT()
  const navigate = useNavigate()
  useDocumentTitle(t('parental.name'))
  const { data, loading, error, run, setData } = useAsync(() => parentalApi.get('/parental/overview'), [])

  useEffect(() => {
    if (error?.status === 401) {
      parentalApi.setToken(null)
      navigate('/parental/login', { replace: true })
    }
  }, [error, navigate])

  const logout = useCallback(() => {
    parentalApi.setToken(null)
    navigate('/parental/login', { replace: true })
  }, [navigate])

  const patch = useCallback((partial) => setData((prev) => ({ ...prev, ...partial })), [setData])

  const pendingCount = data?.requests?.filter((r) => r.status === 'pendente').length || 0
  const base = '/parental/painel'
  const groups = GROUPS.map((g) => ({
    key: g.key,
    label: t(`parental.shell.groups.${g.key}`),
    items: g.items.map((s) => ({
      key: s.key,
      to: s.path ? `${base}/${s.path}` : base,
      end: !s.path,
      label: t(`parental.nav.${s.key}`),
      icon: s.icon,
      count: s.key === 'requests' && pendingCount > 0 ? pendingCount : undefined,
      countTone: 'reward',
      countLabel: t('parental.requests.count', { count: pendingCount })
    }))
  }))

  return (
    <PanelShell product={t('parental.name')} home={base} groups={groups} user={data ? { name: data.guardian.name, meta: t('parental.header.childOf', { name: data.child.name }) } : null} onLogout={logout} labels={{ nav: t('parental.nav.label'), skip: t('parental.shell.skip'), menu: t('parental.shell.menu'), close: t('parental.shell.close'), logout: t('parental.header.logout') }}>
      {loading && !data ? (
        <div className={styles.skeletonStack} aria-busy="true" aria-label={t('parental.states.loading')}>
          <Skeleton height={120} />
          <Skeleton height={200} />
          <Skeleton height={160} />
        </div>
      ) : error && !data ? (
        <div className={styles.errorBox}>
          <Banner tone="danger" icon="alert">
            <strong>{t('parental.states.errorTitle')}</strong>
            <div>{t('parental.states.errorText')}</div>
          </Banner>
          <Button variant="ghost" icon="refresh" onClick={() => run().catch(() => {})}>
            {t('parental.states.retry')}
          </Button>
        </div>
      ) : data ? (
        <Routes>
          <Route index element={<ParentalSummary data={data} />} />
          <Route path="permissoes" element={<ParentalPermissions data={data} onChange={patch} />} />
          <Route path="solicitacoes" element={<ParentalRequests data={data} onChange={patch} />} />
          <Route path="atividade" element={<ParentalActivity data={data} />} />
          <Route path="*" element={<ParentalSummary data={data} />} />
        </Routes>
      ) : null}
    </PanelShell>
  )
}
