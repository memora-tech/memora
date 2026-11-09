import { Panel, ScreenHeader, StatTile, Badge } from '../../design-system/index.js'
import { Meter, PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { fmtNumber, fmtDate, pct } from '../../lib/format.js'
import styles from './partner.module.css'

const STATUS_TONE = { emitido: 'brand', utilizado: 'success', expirado: 'neutral' }

export function PartnerReport({ data }) {
  const t = useT()
  const { conversion, redemptions } = data

  return (
    <>
      <ScreenHeader
        size="compact"
        eyebrow={t('partner.shell.groups.performance')}
        title={t('partner.report.title')}
        lead={t('partner.pages.reportLead')}
        actions={
          conversion ? (
            <Badge tone="neutral" icon="calendar">
              {conversion.period}
            </Badge>
          ) : null
        }
      />

      {conversion ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile size="compact" icon="gift" label={t('partner.report.redemptions')} value={fmtNumber(conversion.redemptions)} />
            <StatTile size="compact" icon="check" label={t('partner.report.confirmed')} value={fmtNumber(conversion.confirmedUse)} note={<Meter value={pct(conversion.confirmedUse, conversion.redemptions)} tone="success" label={t('partner.report.rate')} />} />
            <StatTile size="compact" icon="clock" label={t('partner.report.expired')} value={fmtNumber(conversion.expired)} note={<Meter value={pct(conversion.expired, conversion.redemptions)} tone="warning" label={t('partner.report.expired')} />} />
            <StatTile size="compact" tone="ink" icon="target" label={t('partner.report.rate')} value={`${pct(conversion.confirmedUse, conversion.redemptions)}%`} note={t('partner.pages.funnel')} />
          </div>

          <Panel tone="quiet" title={t('partner.report.cells')} icon="users" labelledBy="cells-title" bodyClassName={styles.panelFlush}>
            <p className={styles.cardSub} style={{ padding: '14px 18px 0' }}>
              {t('partner.report.cellsNote', { min: conversion.minCell })}
            </p>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableCompact}`}>
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
                      <th scope="row">{cell.label}</th>
                      <td className={`${styles.num} ${cell.shown ? '' : styles.suppressed}`}>{cell.shown ? fmtNumber(cell.n) : `${t('partner.report.suppressed')} · ${cell.suppressed || ''}`.trim()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : (
        <PanelEmpty icon="chart" title={t('partner.report.empty')} />
      )}

      <Panel tone="quiet" title={t('partner.redemptions.all')} icon="qr" labelledBy="all-title" bodyClassName={styles.panelFlush}>
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.tableCompact} ${styles.tableStack}`} role="table">
            <thead>
              <tr role="row">
                <th scope="col" role="columnheader">
                  {t('partner.validate.code')}
                </th>
                <th scope="col" role="columnheader">
                  {t('partner.redemptions.dateColumn')}
                </th>
                <th scope="col" role="columnheader">
                  {t('partner.redemptions.statusColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} role="row">
                  <th scope="row" role="rowheader" className={styles.codeCell}>
                    {r.code}
                  </th>
                  <td role="cell" data-label={t('partner.redemptions.dateColumn')}>
                    {fmtDate(r.redeemedAt)}
                  </td>
                  <td role="cell" data-label={t('partner.redemptions.statusColumn')}>
                    <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`partner.redemptions.status.${r.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
