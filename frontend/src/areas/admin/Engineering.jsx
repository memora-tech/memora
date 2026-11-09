import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Chip, Toggle, Panel, SectionTitle, ScreenHeader, StatTile, Stat, ConfirmDialog, useToast } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { Sparkline, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtBRL, fmtDate, fmtDateShort, fmtNumber } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard } from './adminSession.js'

export function Engineering() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  const [killing, setKilling] = useState(null)
  const [busy, setBusy] = useState(null)
  useDocumentTitle(t('admin.engineering.title'))
  const state = useAdminData(() => adminApi.get('/admin/engineering/overview'))
  const data = state.data
  const eyebrow = useSectionEyebrow('engenharia')
  const costs = data?.aiCosts || []
  const lastCost = costs[costs.length - 1]
  const costShare = lastCost?.revenuePerActiveUserBRL ? Math.round((lastCost.costPerActiveUserBRL / lastCost.revenuePerActiveUserBRL) * 100) : 0
  const costOver = lastCost ? costShare > (lastCost.thresholdPct || 60) : false
  const slo = data?.slo

  const patchFlag = async (flag, body) => {
    setBusy(flag.key)
    try {
      const res = await adminApi.patch(`/admin/engineering/flags/${flag.key}`, body)
      state.setData({ ...data, flags: data.flags.map((f) => (f.key === flag.key ? res.flag : f)) })
      toast.show({ message: t('admin.engineering.flagSaved'), icon: 'check' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
      setKilling(null)
    }
  }

  return (
    <>
      <ScreenHeader
        size="compact"
        eyebrow={eyebrow}
        title={t('admin.engineering.title')}
        lead={t('admin.pages.engineering.lead')}
        actions={
          data ? (
            <div className={styles.chips}>
              {data.environments.map((env) => (
                <Chip key={env} tone="neutral" icon="layers">
                  {env}
                </Chip>
              ))}
            </div>
          ) : null
        }
      />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile
              size="compact"
              icon="zap"
              label={t('admin.engineering.studyP95')}
              value={`${slo.studyP95Ms} ms`}
              note={
                <Trend tone={slo.studyP95Ms <= slo.targetP95Ms ? 'success' : 'danger'} icon={slo.studyP95Ms <= slo.targetP95Ms ? 'check' : 'alert'}>
                  {t('admin.engineering.target', { value: slo.targetP95Ms })}
                </Trend>
              }
            />
            <StatTile
              size="compact"
              icon="zap"
              label={t('admin.engineering.studyP99')}
              value={`${slo.studyP99Ms} ms`}
              note={
                <Trend tone={slo.studyP99Ms <= slo.targetP99Ms ? 'success' : 'danger'} icon={slo.studyP99Ms <= slo.targetP99Ms ? 'check' : 'alert'}>
                  {t('admin.engineering.target', { value: slo.targetP99Ms })}
                </Trend>
              }
            />
            <StatTile size="compact" icon="shield" label={t('admin.engineering.availabilityCore')} value={`${slo.availabilityCore}%`} note={`${t('admin.engineering.availabilityOther')}: ${slo.availabilityOther}%`} />
            {lastCost ? (
              <StatTile
                size="compact"
                icon="sparkle"
                label={t('admin.pages.engineering.kpiCost')}
                value={fmtBRL(lastCost.costPerActiveUserBRL)}
                note={
                  <>
                    <Trend tone={costOver ? 'warning' : 'success'}>{t('admin.pages.engineering.noteCost', { pct: costShare })}</Trend>
                    <Sparkline values={costs.map((c) => c.costPerActiveUserBRL)} tone={costOver ? 'warning' : 'brand'} width={96} height={26} />
                  </>
                }
              />
            ) : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.tableStack}`} role="table">
              <caption>
                {t('admin.engineering.flags')}
                <small>{t('admin.engineering.killText')}</small>
              </caption>
              <thead>
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {t('admin.engineering.flag')}
                  </th>
                  <th scope="col" role="columnheader">
                    {t('admin.engineering.integration')}
                  </th>
                  <th scope="col" role="columnheader">
                    {t('admin.common.status')}
                  </th>
                  <th scope="col" role="columnheader">
                    {t('admin.engineering.kill')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.flags.map((f) => (
                  <tr key={f.key} role="row">
                    <th scope="row" role="rowheader">
                      <div className={styles.cellStack}>
                        <span className={styles.cellTitle}>{f.label}</span>
                        <span className={`${styles.cellMeta} ${styles.mono}`}>{f.key}</span>
                      </div>
                    </th>
                    <td role="cell" data-label={t('admin.engineering.integration')}>
                      {f.integration}
                    </td>
                    <td role="cell" data-label={t('admin.common.status')}>
                      <Toggle label={f.on ? t('admin.engineering.on') : t('admin.engineering.off')} checked={f.on} disabled={f.kill || busy === f.key} lockedReason={f.kill ? t('admin.engineering.killActive') : undefined} onChange={(v) => patchFlag(f, { on: v })} />
                    </td>
                    <td role="cell" data-label={t('admin.engineering.kill')}>
                      {f.kill ? (
                        <Button variant="soft" size="small" icon="refresh" onClick={() => patchFlag(f, { kill: false, on: true })} loading={busy === f.key}>
                          {t('admin.engineering.releaseKill')}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="small" icon="zap" onClick={() => setKilling(f)}>
                          {t('admin.engineering.activateKill')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Panel tone="quiet" title={t('admin.engineering.aiCosts')} icon="chart" labelledBy="aicost-title">
            <p className={styles.cellMeta}>{t('admin.engineering.aiCostsIntro', { pct: data.aiCosts[0]?.thresholdPct ?? 60 })}</p>
            <AiCostChart rows={data.aiCosts} />
          </Panel>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.engineering.noaQuality')}
                <small>{t('admin.engineering.noaIntro')}</small>
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.engineering.actionKey')}</th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.acceptance')}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.feedback')}
                  </th>
                  <th scope="col">{t('admin.engineering.window')}</th>
                  <th scope="col">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.noaQuality.map((q) => (
                  <tr key={q.action}>
                    <th scope="row" className={styles.mono}>
                      {q.action}
                    </th>
                    <td className={styles.num}>{Math.round(q.acceptance * 100)}%</td>
                    <td className={styles.num}>{Math.round(q.feedbackPositive * 100)}%</td>
                    <td>{t('admin.engineering.days', { count: q.days })}</td>
                    <td>
                      {q.flagged ? (
                        <Badge tone="danger" icon="alert">
                          {t('admin.engineering.flagged')}
                        </Badge>
                      ) : (
                        <span className={styles.cellMeta}>{t('admin.common.none')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.engineering.templates')}
                <small>{t('admin.engineering.templatesIntro', { pct: Math.round((data.notificationOptOutLimit ?? 0.02) * 100) })}</small>
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.engineering.template')}</th>
                  <th scope="col">{t('admin.engineering.channel')}</th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.sent')}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.delivered')}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.acted')}
                  </th>
                  <th scope="col" className={styles.num}>
                    {t('admin.engineering.optOut')}
                  </th>
                  <th scope="col">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(data.notificationTemplates || []).map((tpl) => (
                  <tr key={tpl.key}>
                    <th scope="row" className={styles.mono}>
                      {tpl.key}
                    </th>
                    <td>
                      {t(`admin.engineering.channels.${tpl.channel}`)} · {t(`admin.engineering.categories.${tpl.category}`)}
                    </td>
                    <td className={styles.num}>{fmtNumber(tpl.sent)}</td>
                    <td className={styles.num}>{Math.round(tpl.delivered * 100)}%</td>
                    <td className={styles.num}>{Math.round(tpl.acted * 100)}%</td>
                    <td className={styles.num}>{(tpl.optOut * 100).toFixed(1)}%</td>
                    <td>
                      {tpl.disabled ? (
                        <Badge tone="danger" icon="alert">
                          {t('admin.engineering.templateDisabled')}
                        </Badge>
                      ) : tpl.transactional ? (
                        <Badge tone="brand">{t('admin.engineering.templateTransactional')}</Badge>
                      ) : (
                        <Badge tone="success">{t('admin.engineering.templateActive')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.antifraud?.length ? (
            <Banner tone="warning" icon="alert">
              {t('admin.engineering.antifraud', { count: data.antifraud.length })}
            </Banner>
          ) : null}
          <div className={styles.grid2}>
            <Panel tone="quiet" title={t('admin.engineering.slo')} icon="clock" labelledBy="slo-title">
              <div className={styles.statsRow}>
                <Stat value={fmtNumber(data.slo.concurrent)} label={t('admin.engineering.concurrent')} />
                <Stat value={fmtNumber(data.slo.ingestionPerSec)} label={t('admin.engineering.ingestion')} />
                <Stat value={`${data.slo.generationP50Sec} s`} label={t('admin.engineering.generationP50')} />
                <Stat value={`${data.slo.generationP95Sec} s`} label={t('admin.engineering.generationP95')} />
              </div>
              <div className={styles.chips}>
                <Chip tone="neutral" icon="clock">
                  {t('admin.engineering.rpo')} {data.slo.rpoMinutes} min
                </Chip>
                <Chip tone="neutral" icon="clock">
                  {t('admin.engineering.rto')} {data.slo.rtoHours} h
                </Chip>
                <Chip tone="success" icon="refresh">
                  {t('admin.engineering.lastRestore')}: {fmtDate(data.slo.lastRestoreTest)}
                </Chip>
              </div>
            </Panel>
            <Panel tone="quiet" title={t('admin.engineering.environments')} icon="layers" labelledBy="env-title">
              <div className={styles.chips}>
                <Chip tone="neutral" icon="refresh">
                  {t('admin.engineering.rollback', { minutes: data.rollbackMinutes })}
                </Chip>
              </div>
              <SectionTitle as="h3">{t('admin.engineering.regions')}</SectionTitle>
              <dl className={styles.definition}>
                <dt>{t('admin.engineering.regionsData')}</dt>
                <dd>{data.regions.data}</dd>
                <dt>{t('admin.engineering.regionsAi')}</dt>
                <dd>{data.regions.ai}</dd>
                <dt>{t('admin.engineering.pseudonymization')}</dt>
                <dd>{data.regions.pseudonymization ? t('admin.common.yes') : t('admin.common.no')}</dd>
              </dl>
              <SectionTitle as="h3">{t('admin.engineering.queues')}</SectionTitle>
              <div className={styles.statsRow}>
                <Stat value={data.queues.generation.premium} label={t('admin.engineering.queuePremium')} />
                <Stat value={data.queues.generation.free} label={t('admin.engineering.queueFree')} />
                <Stat value={data.queues.generation.deadLetter} label={t('admin.engineering.deadLetter')} />
              </div>
            </Panel>
          </div>
        </>
      ) : null}
      <ConfirmDialog open={Boolean(killing)} onClose={() => setKilling(null)} onConfirm={() => patchFlag(killing, { kill: true })} title={killing ? t('admin.engineering.killTitle', { label: killing.label }) : ''} confirmLabel={t('admin.engineering.activateKill')} danger loading={Boolean(killing && busy === killing.key)}>
        <p>{t('admin.engineering.killText')}</p>
      </ConfirmDialog>
    </>
  )
}

function AiCostChart({ rows }) {
  const t = useT()
  const width = 960
  const height = 240
  const pad = { top: 16, right: 12, bottom: 36, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const revenue = rows[0]?.revenuePerActiveUserBRL || 1
  const thresholdPct = rows[0]?.thresholdPct || 60
  const threshold = (revenue * thresholdPct) / 100
  const max = Math.max(revenue, ...rows.map((r) => r.costPerActiveUserBRL)) * 1.1
  const y = (v) => pad.top + innerH - (v / max) * innerH
  const barW = innerW / rows.length
  const above = rows.filter((r) => r.costPerActiveUserBRL > threshold).length

  return (
    <div className={styles.stack}>
      {above > 0 ? (
        <Banner tone="warning" icon="alert">
          {t('admin.engineering.aboveThreshold', { count: above })}
        </Banner>
      ) : null}
      <div className={styles.chartScroll}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label={t('admin.engineering.aiCosts')}>
          <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="var(--color-border)" />
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              {f ? <line x1={pad.left} y1={y(max * f)} x2={width - pad.right} y2={y(max * f)} stroke="var(--gray-200)" strokeDasharray="2 4" /> : null}
              <text x={pad.left - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="var(--color-text-secondary)">
                {fmtBRL(max * f)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const over = r.costPerActiveUserBRL > threshold
            const x = pad.left + i * barW + barW * 0.15
            const h = pad.top + innerH - y(r.costPerActiveUserBRL)
            return (
              <g key={r.day}>
                <rect x={x} y={y(r.costPerActiveUserBRL)} width={barW * 0.7} height={h} rx="3" fill={over ? 'var(--orange-500)' : 'var(--brand-500)'} opacity={over ? 1 : 0.85}>
                  <title>
                    {fmtDateShort(r.day)}: {fmtBRL(r.costPerActiveUserBRL)}
                  </title>
                </rect>
                {i % 2 === 0 ? (
                  <text x={x + barW * 0.35} y={pad.top + innerH + 14} textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">
                    {fmtDateShort(r.day)}
                  </text>
                ) : null}
              </g>
            )
          })}
          <line x1={pad.left} y1={y(threshold)} x2={width - pad.right} y2={y(threshold)} stroke="var(--color-danger)" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={width - pad.right} y={y(threshold) - 4} textAnchor="end" fontSize="10" fill="var(--color-danger)">
            {t('admin.engineering.threshold')} {thresholdPct}% · {fmtBRL(threshold)}
          </text>
          <line x1={pad.left} y1={y(revenue)} x2={width - pad.right} y2={y(revenue)} stroke="var(--color-success)" strokeDasharray="2 4" />
          <text x={width - pad.right} y={y(revenue) - 4} textAnchor="end" fontSize="10" fill="var(--color-success)">
            {t('admin.engineering.revenue')} {fmtBRL(revenue)}
          </text>
        </svg>
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--brand-500)' }} /> {t('admin.engineering.cost')}
        </span>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--orange-500)' }} /> {t('admin.engineering.aboveThreshold', { count: above })}
        </span>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--color-danger)' }} /> {t('admin.engineering.threshold')}
        </span>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--color-success)' }} /> {t('admin.engineering.revenue')}
        </span>
      </div>
    </div>
  )
}
