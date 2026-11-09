import { useCallback, useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { Button, Banner, Skeleton } from '../../design-system/index.js'
import { PanelShell } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { PartnerOverview } from './PartnerOverview.jsx'
import { PartnerCampaigns } from './PartnerCampaigns.jsx'
import { PartnerValidate } from './PartnerValidate.jsx'
import { PartnerReport } from './PartnerReport.jsx'
import { PartnerPositioning } from './PartnerPositioning.jsx'
import styles from './partner.module.css'

const GROUPS = [
  {
    key: 'performance',
    items: [
      { path: '', key: 'overview', icon: 'home' },
      { path: 'relatorio', key: 'report', icon: 'chart' }
    ]
  },
  {
    key: 'operation',
    items: [
      { path: 'campanhas', key: 'campaigns', icon: 'gift' },
      { path: 'validar', key: 'validate', icon: 'qr' }
    ]
  },
  {
    key: 'commercial',
    items: [{ path: 'posicionamento', key: 'positioning', icon: 'layers' }]
  }
]

export function PartnerDashboard() {
  const t = useT()
  const navigate = useNavigate()
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
  const groups = GROUPS.map((g) => ({
    key: g.key,
    label: t(`partner.shell.groups.${g.key}`),
    items: g.items.map((s) => ({
      key: s.key,
      to: s.path ? `${base}/${s.path}` : base,
      end: !s.path,
      label: t(`partner.nav.${s.key}`),
      icon: s.icon,
      count: s.key === 'overview' && alertCount > 0 ? alertCount : undefined,
      countTone: 'reward',
      countLabel: t('partner.alerts.title')
    }))
  }))

  return (
    <PanelShell product={t('partner.name')} home={base} groups={groups} user={data ? { name: data.partner.contact || data.partner.name, meta: data.partner.name } : null} onLogout={logout} labels={{ nav: t('partner.nav.label'), skip: t('partner.shell.skip'), menu: t('partner.shell.menu'), close: t('partner.shell.close'), logout: t('partner.header.logout') }}>
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
    </PanelShell>
  )
}
