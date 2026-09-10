import { useCallback, useEffect } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { Button, Wordmark, Avatar, Banner, Skeleton, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { PartnerOverview } from './PartnerOverview.jsx'
import { PartnerCampaigns } from './PartnerCampaigns.jsx'
import { PartnerValidate } from './PartnerValidate.jsx'
import { PartnerReport } from './PartnerReport.jsx'
import { PartnerPositioning } from './PartnerPositioning.jsx'
import styles from './partner.module.css'

const SECTIONS = [
  { path: '', key: 'overview', icon: 'home' },
  { path: 'campanhas', key: 'campaigns', icon: 'gift' },
  { path: 'validar', key: 'validate', icon: 'qr' },
  { path: 'relatorio', key: 'report', icon: 'chart' },
  { path: 'posicionamento', key: 'positioning', icon: 'layers' }
]

export function PartnerDashboard() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  useDocumentTitle(t('partner.name'))
  const { data, loading, error, run, setData } = useAsync(() => partnerApi.get('/partner/overview'), [])

  useEffect(() => {
    if (error?.status === 401) {
      partnerApi.setToken(null)
      navigate('/parceiro/login', { replace: true })
    }
  }, [error, navigate])

  const logout = useCallback(() => {
    partnerApi.setToken(null)
    navigate('/parceiro/login', { replace: true })
  }, [navigate])

  const patch = useCallback((partial) => setData((prev) => ({ ...prev, ...(typeof partial === 'function' ? partial(prev) : partial) })), [setData])

  const alertCount = data?.alerts?.length || 0
  const base = '/parceiro/painel'
  const current = location.pathname.replace(base, '').replace(/^\//, '').split('/')[0]

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrand}>
            <Wordmark size={22} to="/parceiro/painel" />
            <span className={styles.headerPanel}>{t('partner.name')}</span>
          </div>
          <div className={styles.headerUser}>
            {data ? (
              <>
                <div className={styles.headerName}>
                  <strong>{data.partner.name}</strong>
                  <span>{data.partner.contact}</span>
                </div>
                <Avatar name={data.partner.name} />
              </>
            ) : null}
            <Button variant="ghost" icon="logout" size="small" onClick={logout}>
              {t('partner.header.logout')}
            </Button>
          </div>
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label={t('partner.nav.label')}>
          {SECTIONS.map((s) => {
            const active = (current || '') === s.path
            return (
              <Link key={s.key} to={s.path ? `${base}/${s.path}` : base} className={styles.navLink} aria-current={active ? 'page' : undefined}>
                <Icon name={s.icon} size={18} />
                {t(`partner.nav.${s.key}`)}
                {s.key === 'overview' && alertCount > 0 ? (
                  <span className={styles.navBadge} aria-label={t('partner.alerts.title')}>
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
        <main className={styles.content} id="conteudo">
          {loading && !data ? (
            <div className={styles.skeletonStack} aria-busy="true" aria-label={t('partner.states.loading')}>
              <Skeleton height={120} />
              <Skeleton height={200} />
              <Skeleton height={160} />
            </div>
          ) : error && !data ? (
            <div className={styles.errorBox}>
              <Banner tone="danger" icon="alert">
                <strong>{t('partner.states.errorTitle')}</strong>
                <div>{t('partner.states.errorText')}</div>
              </Banner>
              <Button variant="ghost" icon="refresh" onClick={() => run().catch(() => {})}>
                {t('partner.states.retry')}
              </Button>
            </div>
          ) : data ? (
            <Routes>
              <Route index element={<PartnerOverview data={data} onChange={patch} />} />
              <Route path="campanhas" element={<PartnerCampaigns data={data} onChange={patch} />} />
              <Route path="validar" element={<PartnerValidate data={data} onChange={patch} />} />
              <Route path="relatorio" element={<PartnerReport data={data} />} />
              <Route path="posicionamento" element={<PartnerPositioning data={data} />} />
              <Route path="*" element={<PartnerOverview data={data} onChange={patch} />} />
            </Routes>
          ) : null}
        </main>
      </div>
    </>
  )
}
