import styles from './admin.module.css'
import { Badge, Chip, Icon, ScreenHeader, StatTile } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { Meter, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtBRL, fmtDate, fmtNumber } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData } from './adminSession.js'

const STATUS_TONE = { pago: 'success', aguardando_pagamento: 'warning', falhou: 'danger', reembolsado: 'neutral' }

export function Finance() {
  const t = useT()
  useDocumentTitle(t('admin.finance.title'))
  const state = useAdminData(() => adminApi.get('/admin/finance/overview'))
  const data = state.data
  const eyebrow = useSectionEyebrow('financeiro')
  const payments = data?.payments || []
  const paid = payments.filter((p) => p.status === 'pago').length
  const paidPct = payments.length ? Math.round((paid / payments.length) * 100) : 0

  return (
    <>
      <ScreenHeader
        size="compact"
        eyebrow={eyebrow}
        title={t('admin.finance.title')}
        lead={t('admin.pages.finance.lead')}
        actions={
          data ? (
            <div className={styles.chips}>
              <Chip tone="brand" icon="receipt">
                {t('admin.finance.nfseSla', { hours: data.summary.nfseSlaHours })}
              </Chip>
              <Chip tone="neutral" icon="archive">
                {t('admin.finance.fiscalRetention', { years: data.summary.fiscalRetentionYears })}
              </Chip>
            </div>
          ) : null
        }
      />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile size="compact" tone="ink" icon="wallet" label={t('admin.finance.mrr')} value={fmtBRL(data.summary.mrrBRL)} note={t('admin.pages.finance.notePaid', { pct: paidPct })} />
            <StatTile size="compact" icon="star" label={t('admin.finance.activePremium')} value={fmtNumber(data.summary.activePremium)} note={<Meter value={paidPct} tone="success" label={t('admin.pages.finance.notePaid', { pct: paidPct })} />} />
            <StatTile size="compact" icon="refresh" label={t('admin.finance.refunds30d')} value={fmtNumber(data.summary.refunds30d)} />
            <StatTile
              size="compact"
              icon="alert"
              label={t('admin.finance.dunning')}
              value={fmtNumber(data.summary.dunning)}
              note={
                data.summary.dunning ? (
                  <Trend tone="warning" icon="alert">
                    {t('admin.pages.finance.noteDunning')}
                  </Trend>
                ) : (
                  <Trend tone="success" icon="check">
                    {t('admin.pages.finance.noteOk')}
                  </Trend>
                )
              }
            />
          </div>
          <div className={panelStyles.rules}>
            <p className={panelStyles.callout} data-tone="warning">
              <Icon name="alert" size={18} />
              <span>
                <strong>{t('admin.finance.dunningPolicy')}</strong> · {data.dunningPolicy}
              </span>
            </p>
            <p className={panelStyles.callout}>
              <Icon name="info" size={18} />
              <span>{t('admin.finance.refundPolicy')}</span>
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.finance.payments')}
                <small>{t('admin.finance.caption')}</small>
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.finance.date')}</th>
                  <th scope="col">{t('admin.finance.user')}</th>
                  <th scope="col">{t('admin.finance.plan')}</th>
                  <th scope="col" className={styles.num}>
                    {t('admin.finance.amount')}
                  </th>
                  <th scope="col">{t('admin.finance.method')}</th>
                  <th scope="col">{t('admin.finance.status')}</th>
                  <th scope="col">{t('admin.finance.nfse')}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.at)}</td>
                    <th scope="row" className={styles.mono}>
                      {p.userId}
                    </th>
                    <td>
                      {t(`admin.plan.${p.plan === 'premium' ? 'premium' : 'free'}`)}
                      {p.cycle ? ` · ${p.cycle}` : ''}
                    </td>
                    <td className={styles.num}>{fmtBRL(p.amountBRL)}</td>
                    <td>{p.method}</td>
                    <td>
                      <Badge tone={STATUS_TONE[p.status] || 'neutral'}>{t(`admin.finance.statuses.${p.status}`)}</Badge>
                    </td>
                    <td>{p.nfse ? <span className={styles.mono}>{p.nfse.number}</span> : p.status === 'pago' ? t('admin.finance.nfsePending') : t('admin.finance.nfseNone')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  )
}
