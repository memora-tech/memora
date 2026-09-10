import { useCallback, useEffect } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { parentalApi } from '../../lib/api.js'
import { Button, Wordmark, Avatar, Banner, Skeleton, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { ParentalSummary } from './ParentalSummary.jsx'
import { ParentalPermissions } from './ParentalPermissions.jsx'
import { ParentalRequests } from './ParentalRequests.jsx'
import { ParentalActivity } from './ParentalActivity.jsx'
import styles from './parental.module.css'

const SECTIONS = [
  { path: '', key: 'summary', icon: 'home' },
  { path: 'permissoes', key: 'permissions', icon: 'shield' },
  { path: 'solicitacoes', key: 'requests', icon: 'bell' },
  { path: 'atividade', key: 'activity', icon: 'clock' }
]

export function ParentalDashboard() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
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
  const current = location.pathname.replace(base, '').replace(/^\//, '').split('/')[0]

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrand}>
            <Wordmark size={22} to="/parental/painel" />
            <span className={styles.headerPanel}>{t('parental.name')}</span>
          </div>
          <div className={styles.headerUser}>
            {data ? (
              <>
                <div className={styles.headerName}>
                  <strong>{data.guardian.name}</strong>
                  <span>{t('parental.header.childOf', { name: data.child.name })}</span>
                </div>
                <Avatar name={data.guardian.name} />
              </>
            ) : null}
            <Button variant="ghost" icon="logout" size="small" onClick={logout}>
              {t('parental.header.logout')}
            </Button>
          </div>
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label={t('parental.nav.label')}>
          {SECTIONS.map((s) => {
            const active = (current || '') === s.path
            return (
              <Link key={s.key} to={s.path ? `${base}/${s.path}` : base} className={styles.navLink} aria-current={active ? 'page' : undefined}>
                <Icon name={s.icon} size={18} />
                {t(`parental.nav.${s.key}`)}
                {s.key === 'requests' && pendingCount > 0 ? (
                  <span className={styles.navBadge} aria-label={t('parental.requests.count', { count: pendingCount })}>
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
        <main className={styles.content} id="conteudo">
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
        </main>
      </div>
    </>
  )
}
