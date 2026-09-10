import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Chip, Toggle, Surface, SectionTitle, Stat, ConfirmDialog, useToast } from '../../design-system/index.js'
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
      <h1 className={styles.title}>{t('admin.engineering.title')}</h1>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{t('admin.engineering.flags')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.engineering.flag')}</th>
                  <th scope="col">{t('admin.engineering.integration')}</th>
                  <th scope="col">{t('admin.common.status')}</th>
                  <th scope="col">{t('admin.engineering.kill')}</th>
                </tr>
              </thead>
              <tbody>
                {data.flags.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">
                      <div className={styles.cellStack}>
                        <span>{f.label}</span>
                        <span className={`${styles.cellMeta} ${styles.mono}`}>{f.key}</span>
                      </div>
                    </th>
                    <td>{f.integration}</td>
                    <td>
                      <Toggle label={f.on ? t('admin.engineering.on') : t('admin.engineering.off')} checked={f.on} disabled={f.kill || busy === f.key} lockedReason={f.kill ? t('admin.engineering.killActive') : undefined} onChange={(v) => patchFlag(f, { on: v })} />
                    </td>
                    <td>
                      {f.kill ? (
                        <Button variant="soft" size="small" icon="refresh" onClick={() => patchFlag(f, { kill: false, on: true })} loading={busy === f.key}>
                          {t('admin.engineering.releaseKill')}
                        </Button>
                      ) : (
                        <Button variant="danger" size="small" icon="zap" onClick={() => setKilling(f)}>
                          {t('admin.engineering.activateKill')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.engineering.aiCosts')}</SectionTitle>
            <p className={styles.cellMeta}>{t('admin.engineering.aiCostsIntro', { pct: data.aiCosts[0]?.thresholdPct ?? 60 })}</p>
            <AiCostChart rows={data.aiCosts} />
          </Surface>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.engineering.noaQuality')} · {t('admin.engineering.noaIntro')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.engineering.actionKey')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.acceptance')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.feedback')}</th>
                  <th scope="col">{t('admin.engineering.window')}</th>
                  <th scope="col">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.noaQuality.map((q) => (
                  <tr key={q.action}>
                    <th scope="row" className={styles.mono}>{q.action}</th>
                    <td className={styles.num}>{Math.round(q.acceptance * 100)}%</td>
                    <td className={styles.num}>{Math.round(q.feedbackPositive * 100)}%</td>
                    <td>{t('admin.engineering.days', { count: q.days })}</td>
                    <td>{q.flagged ? <Badge tone="danger" icon="alert">{t('admin.engineering.flagged')}</Badge> : <Badge tone="success">{t('admin.common.none')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>
                {t('admin.engineering.templates')} · {t('admin.engineering.templatesIntro', { pct: Math.round((data.notificationOptOutLimit ?? 0.02) * 100) })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.engineering.template')}</th>
                  <th scope="col">{t('admin.engineering.channel')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.sent')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.delivered')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.acted')}</th>
                  <th scope="col" className={styles.num}>{t('admin.engineering.optOut')}</th>
                  <th scope="col">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(data.notificationTemplates || []).map((tpl) => (
                  <tr key={tpl.key}>
                    <th scope="row" className={styles.mono}>{tpl.key}</th>
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
            <Surface className={styles.stack}>
              <SectionTitle as="h2">{t('admin.engineering.slo')}</SectionTitle>
              <div className={styles.statsRow}>
                <Stat value={`${data.slo.studyP95Ms} ms`} label={`${t('admin.engineering.studyP95')} · ${t('admin.engineering.target', { value: data.slo.targetP95Ms })}`} />
                <Stat value={`${data.slo.studyP99Ms} ms`} label={`${t('admin.engineering.studyP99')} · ${t('admin.engineering.target', { value: data.slo.targetP99Ms })}`} />
                <Stat value={fmtNumber(data.slo.concurrent)} label={t('admin.engineering.concurrent')} />
                <Stat value={fmtNumber(data.slo.ingestionPerSec)} label={t('admin.engineering.ingestion')} />
                <Stat value={`${data.slo.generationP50Sec} s`} label={t('admin.engineering.generationP50')} />
                <Stat value={`${data.slo.generationP95Sec} s`} label={t('admin.engineering.generationP95')} />
                <Stat value={`${data.slo.availabilityCore}%`} label={t('admin.engineering.availabilityCore')} />
                <Stat value={`${data.slo.availabilityOther}%`} label={t('admin.engineering.availabilityOther')} />
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
            </Surface>
            <Surface className={styles.stack}>
              <SectionTitle as="h2">{t('admin.engineering.environments')}</SectionTitle>
              <div className={styles.chips}>
                {data.environments.map((env) => (
                  <Chip key={env} tone="brand" icon="layers">
                    {env}
                  </Chip>
                ))}
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
            </Surface>
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
  const width = 560
  const height = 200
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
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label={t('admin.engineering.aiCosts')}>
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="var(--color-border)" />
        <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="var(--color-border)" />
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
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
              <rect x={x} y={y(r.costPerActiveUserBRL)} width={barW * 0.7} height={h} rx="3" fill={over ? 'var(--color-warning)' : 'var(--color-accent)'}>
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
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--color-accent)' }} /> {t('admin.engineering.cost')}
        </span>
        <span>
          <i className={styles.swatch} style={{ background: 'var(--color-warning)' }} /> {t('admin.engineering.aboveThreshold', { count: above })}
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
