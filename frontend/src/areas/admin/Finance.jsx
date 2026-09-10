import styles from './admin.module.css'
import { Badge, Banner, Surface, Stat, Chip } from '../../design-system/index.js'
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

  return (
    <>
      <h1 className={styles.title}>{t('admin.finance.title')}</h1>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <Surface className={styles.stack}>
            <div className={styles.statsRow}>
              <Stat value={fmtBRL(data.summary.mrrBRL)} label={t('admin.finance.mrr')} />
              <Stat value={fmtNumber(data.summary.activePremium)} label={t('admin.finance.activePremium')} />
              <Stat value={fmtNumber(data.summary.refunds30d)} label={t('admin.finance.refunds30d')} />
              <Stat value={fmtNumber(data.summary.dunning)} label={t('admin.finance.dunning')} />
            </div>
            <div className={styles.chips}>
              <Chip tone="brand" icon="receipt">
                {t('admin.finance.nfseSla', { hours: data.summary.nfseSlaHours })}
              </Chip>
              <Chip tone="neutral" icon="archive">
                {t('admin.finance.fiscalRetention', { years: data.summary.fiscalRetentionYears })}
              </Chip>
            </div>
          </Surface>
          <Banner tone="warning" icon="alert">
            <strong>{t('admin.finance.dunningPolicy')}</strong> · {data.dunningPolicy}
          </Banner>
          <Banner tone="neutral" icon="info">
            {t('admin.finance.refundPolicy')}
          </Banner>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{t('admin.finance.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.finance.date')}</th>
                  <th scope="col">{t('admin.finance.user')}</th>
                  <th scope="col">{t('admin.finance.plan')}</th>
                  <th scope="col" className={styles.num}>{t('admin.finance.amount')}</th>
                  <th scope="col">{t('admin.finance.method')}</th>
                  <th scope="col">{t('admin.finance.status')}</th>
                  <th scope="col">{t('admin.finance.nfse')}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.at)}</td>
                    <th scope="row">{p.userId}</th>
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
