import { Surface, Stat, EmptyState, Badge } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber, fmtDate, pct } from '../../lib/format.js'
import styles from './partner.module.css'

const STATUS_TONE = { emitido: 'brand', utilizado: 'success', expirado: 'neutral' }

export function PartnerReport({ data }) {
  const t = useT()
  const { conversion, redemptions } = data

  return (
    <>
      <h1 className={styles.pageTitle}>{t('partner.report.title')}</h1>

      {conversion ? (
        <>
          <Surface>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{conversion.period}</h2>
            </div>
            <div className={styles.kpis}>
              <Stat value={fmtNumber(conversion.redemptions)} label={t('partner.report.redemptions')} />
              <Stat value={fmtNumber(conversion.confirmedUse)} label={t('partner.report.confirmed')} />
              <Stat value={fmtNumber(conversion.expired)} label={t('partner.report.expired')} />
              <Stat value={`${pct(conversion.confirmedUse, conversion.redemptions)}%`} label={t('partner.report.rate')} />
            </div>
          </Surface>

          <Surface>
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>{t('partner.report.cells')}</h2>
                <p className={styles.cardSub}>{t('partner.report.cellsNote', { min: conversion.minCell })}</p>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('partner.report.cellColumn')}</th>
                    <th scope="col" className={styles.num}>
                      {t('partner.report.peopleColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conversion.cells.map((cell) => (
                    <tr key={cell.label}>
                      <td>{cell.label}</td>
                      <td className={`${styles.num} ${cell.shown ? '' : styles.suppressed}`}>{cell.shown ? fmtNumber(cell.n) : `${t('partner.report.suppressed')} · ${cell.suppressed || ''}`.trim()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </>
      ) : (
        <Surface>
          <EmptyState icon="chart" title={t('partner.report.empty')} />
        </Surface>
      )}

      <Surface>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('partner.redemptions.all')}</h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('partner.validate.code')}</th>
                <th scope="col">{t('partner.redemptions.dateColumn')}</th>
                <th scope="col">{t('partner.redemptions.statusColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id}>
                  <td className="tabnum">{r.code}</td>
                  <td>{fmtDate(r.redeemedAt)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`partner.redemptions.status.${r.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </>
  )
}
