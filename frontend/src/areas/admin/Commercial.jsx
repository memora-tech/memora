import styles from './admin.module.css'
import { Button, Badge, Banner, Panel, ScreenHeader, StatTile, useToast } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { Meter, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtBRL, fmtDate, fmtNumber, fmtRelative } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard } from './adminSession.js'

export function Commercial() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  useDocumentTitle(t('admin.commercial.title'))
  const state = useAdminData(() => adminApi.get('/admin/commercial/overview'))
  const data = state.data
  const eyebrow = useSectionEyebrow('comercial')
  const conversion = data?.dashboard?.redemptions30d ? Math.round((data.dashboard.confirmedUse30d / data.dashboard.redemptions30d) * 100) : 0

  const approveStage = async (partner) => {
    try {
      const res = await adminApi.post(`/admin/commercial/partners/${partner.id}/approve-stage`)
      state.setData({ ...data, partners: data.partners.map((p) => (p.id === partner.id ? { ...p, ...res.partner } : p)) })
      toast.show({ message: t('admin.commercial.stageApproved'), icon: 'check' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <>
      <ScreenHeader size="compact" eyebrow={eyebrow} title={t('admin.commercial.title')} lead={t('admin.pages.commercial.lead')} />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <h2 className="sr-only">{t('admin.commercial.dashboard')}</h2>
          <div className={panelStyles.kpis}>
            <StatTile size="compact" icon="building" label={t('admin.commercial.activePartners')} value={fmtNumber(data.dashboard.activePartners)} />
            <StatTile size="compact" icon="gift" label={t('admin.commercial.redemptions30d')} value={fmtNumber(data.dashboard.redemptions30d)} />
            <StatTile size="compact" icon="check" label={t('admin.commercial.confirmedUse30d')} value={fmtNumber(data.dashboard.confirmedUse30d)} note={<Meter value={conversion} tone={conversion >= 50 ? 'success' : 'warning'} label={t('admin.pages.commercial.noteConversion', { pct: conversion })} />} />
            <StatTile size="compact" tone="ink" icon="wallet" label={t('admin.commercial.cpaRevenue')} value={fmtBRL(data.dashboard.cpaRevenueBRL)} note={t('admin.pages.commercial.noteConversion', { pct: conversion })} />
            <StatTile size="compact" icon="star" label={t('admin.commercial.positioningRevenue')} value={fmtBRL(data.dashboard.positioningRevenueBRL)} />
          </div>
          <section className={styles.stack} aria-label={t('admin.commercial.alerts')}>
            {data.alerts.map((a) => (
              <Banner key={a.id} tone={a.type === 'queda_conversao' ? 'warning' : 'danger'} icon="alert">
                <strong>{t(`admin.commercial.alertType.${a.type}`)}</strong> · {a.text} <span className={styles.cellMeta}>{fmtRelative(a.at)}</span>
              </Banner>
            ))}
          </section>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{t('admin.commercial.partners')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.commercial.partner')}</th>
                  <th scope="col">{t('admin.commercial.cnpj')}</th>
                  <th scope="col">{t('admin.commercial.verification')}</th>
                  <th scope="col">{t('admin.commercial.tier')}</th>
                  <th scope="col">{t('admin.commercial.renewsAt')}</th>
                  <th scope="col">{t('admin.commercial.acceptance')}</th>
                  <th scope="col">{t('admin.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.partners.map((p) => {
                  const stages = p.approvalStages?.length || (p.verified ? 2 : 0)
                  return (
                    <tr key={p.id}>
                      <th scope="row">
                        <div className={styles.cellStack}>
                          <span className={styles.cellTitle}>{p.name}</span>
                          <span className={styles.cellMeta}>
                            {p.category} · {p.campaigns.length} campanhas · {p.redemptions} resgates
                          </span>
                        </div>
                      </th>
                      <td className={styles.mono}>{p.cnpj}</td>
                      <td>
                        <div className={styles.cellStack}>
                          <Badge tone={p.verified ? 'success' : 'warning'}>{p.verified ? t('admin.commercial.verified') : t('admin.commercial.stages', { done: stages })}</Badge>
                          <span className={styles.cellMeta}>{t('admin.commercial.minContract', { months: p.contract.minMonths, penalty: p.contract.penalty })}</span>
                        </div>
                      </td>
                      <td>{p.contract.positioningTier ? `${p.contract.positioningTier} · ${fmtBRL(p.contract.positioningMonthlyBRL)}` : t('admin.commercial.noTier')}</td>
                      <td>{fmtDate(p.contract.renewsAt)}</td>
                      <td>
                        <Badge tone={p.contract.acceptedDigitally ? 'success' : 'warning'}>{p.contract.acceptedDigitally ? t('admin.commercial.digital') : t('admin.commercial.pendingAcceptance')}</Badge>
                      </td>
                      <td>
                        {!p.verified ? (
                          <Button variant="soft" size="small" icon="check" onClick={() => approveStage(p)}>
                            {t('admin.commercial.approveStage')}
                          </Button>
                        ) : (
                          <span className={styles.cellMeta}>{t('admin.common.none')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.grid2}>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableNarrow}`}>
                <caption>{t('admin.commercial.positioningTable')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.commercial.tierName')}</th>
                    <th scope="col" className={styles.num}>
                      {t('admin.commercial.monthly')}
                    </th>
                    <th scope="col">{t('admin.commercial.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positioningTable.map((row) => (
                    <tr key={row.tier}>
                      <th scope="row">{row.tier}</th>
                      <td className={styles.num}>{fmtBRL(row.monthlyBRL)}</td>
                      <td>{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Panel tone="quiet" title={t('admin.commercial.churn')} icon="alert" labelledBy="churn-title" bodyClassName={styles.panelFlush}>
              <p className={styles.cellMeta} style={{ padding: '14px 18px 0' }}>
                {t('admin.commercial.churnIntro')}
              </p>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.tableNarrow}`}>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.commercial.user')}</th>
                      <th scope="col">{t('admin.commercial.signal')}</th>
                      <th scope="col">{t('admin.commercial.action')}</th>
                      <th scope="col">{t('admin.commercial.when')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.churnRisk.map((c) => (
                      <tr key={c.userId}>
                        <th scope="row">{c.name}</th>
                        <td>{c.signal}</td>
                        <td>{c.action}</td>
                        <td>{fmtRelative(c.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </>
  )
}
