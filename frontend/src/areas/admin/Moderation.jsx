import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Badge, Chip, ProgressBar, Segmented, Panel, ScreenHeader, StatRow, StatTile, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative, fmtDateTime } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData } from './adminSession.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'

const RISK_TONE = { baixo: 'success', medio: 'warning', alto: 'danger' }
const STATUS_TONE = { em_triagem: 'neutral', em_revisao: 'brand', aprovado: 'success', rejeitado: 'danger' }

export function slaTone(sla) {
  if (!sla) return undefined
  if (sla.pct >= 100) return 'danger'
  if (sla.alert) return 'warning'
  return undefined
}

export function Moderation() {
  const t = useT()
  const navigate = useNavigate()
  const eyebrow = useSectionEyebrow('moderacao')
  const [filter, setFilter] = useState('pending')
  useDocumentTitle(t('admin.moderation.title'))
  const state = useAdminData(() => adminApi.get('/admin/moderation/queue'))
  const data = state.data
  const all = data?.queue || []
  const queue = all.filter((p) => (filter === 'pending' ? !p.decidedAt : filter === 'decided' ? Boolean(p.decidedAt) : true))
  const open = all.filter((p) => !p.decidedAt)
  const alerts = open.filter((p) => p.sla?.alert || p.sla?.pct >= 100).length
  const high = open.filter((p) => p.risk?.level === 'alto').length
  const premium = open.filter((p) => p.plan === 'premium').length
  const decided = all.length - open.length

  return (
    <>
      <ScreenHeader size="compact" eyebrow={eyebrow} title={t('admin.moderation.title')} lead={t('admin.pages.moderation.lead')} />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile size="compact" icon="shield" label={t('admin.pages.moderation.kpiPending')} value={open.length} note={<Trend tone="brand">{t('admin.pages.moderation.notePremium', { count: premium })}</Trend>} />
            <StatTile
              size="compact"
              icon="clock"
              label={t('admin.pages.moderation.kpiAlert')}
              value={alerts}
              note={
                alerts ? (
                  <Trend tone="warning" icon="alert">
                    {t('admin.pages.moderation.noteAlert', { pct: data.pipeline.alertAtPct })}
                  </Trend>
                ) : (
                  <Trend tone="success" icon="check">
                    {t('admin.pages.moderation.noteClear')}
                  </Trend>
                )
              }
            />
            <StatTile size="compact" icon="flag" label={t('admin.pages.moderation.kpiHighRisk')} value={high} note={<Trend tone={high ? 'danger' : 'neutral'}>{t('admin.pages.moderation.noteHighRisk')}</Trend>} />
            <StatTile size="compact" icon="check" label={t('admin.pages.moderation.kpiDecided')} value={decided} />
          </div>
          <div className={panelStyles.stickyBar}>
            <Segmented
              label={t('admin.moderation.filters')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: t('admin.moderation.pending') },
                { value: 'decided', label: t('admin.moderation.decided') },
                { value: 'all', label: t('admin.moderation.all') }
              ]}
            />
            <span className={panelStyles.barMeta} aria-live="polite">
              {t('admin.pages.moderation.shown', { count: queue.length })}
            </span>
          </div>
          {queue.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>
                  {t('admin.moderation.title')}
                  <small>{t('admin.moderation.caption')}</small>
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.moderation.deck')}</th>
                    <th scope="col">{t('admin.moderation.plan')}</th>
                    <th scope="col">{t('admin.moderation.risk')}</th>
                    <th scope="col">{t('admin.moderation.slaColumn')}</th>
                    <th scope="col">{t('admin.moderation.review')}</th>
                    <th scope="col">{t('admin.common.status')}</th>
                    <th scope="col">
                      <span className="sr-only">{t('admin.common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((p) => {
                    const tone = p.decidedAt ? undefined : slaTone(p.sla)
                    return (
                      <tr key={p.id}>
                        <th scope="row">
                          <div className={styles.deckCell}>
                            <span className={styles.deckGlyph} aria-hidden="true">
                              {(p.deckName || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <div className={styles.cellStack}>
                              <span>
                                {p.kind === 'material' ? <Badge tone="brand">{t(`admin.moderation.kind.${p.materialKind}`)}</Badge> : null} {p.deckName} <span className={styles.cellMeta}>{t('admin.moderation.version', { version: p.version })}</span>
                              </span>
                              <span className={styles.cellMeta}>
                                {p.authorName} · {t(p.kind === 'material' ? 'admin.moderation.blocks' : 'admin.moderation.cards', { count: p.cardCount })} · {t('admin.moderation.submitted', { when: fmtRelative(p.submittedAt) })}
                              </span>
                            </div>
                          </div>
                        </th>
                        <td>
                          <Badge tone={p.plan === 'premium' ? 'reward' : 'neutral'}>{t(`admin.plan.${p.plan}`)}</Badge>
                        </td>
                        <td>
                          <div className={styles.riskCell}>
                            <Badge tone={RISK_TONE[p.risk.level]}>{t(`admin.moderation.riskLevel.${p.risk.level}`)}</Badge>
                            <span className={styles.riskScore}>{t('admin.moderation.riskScore', { score: p.risk.score })}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.slaCell}>
                            <ProgressBar value={p.sla.pct} max={100} tone={tone} thin label={t('admin.moderation.slaColumn')} />
                            <span className={styles.slaText} data-tone={tone}>
                              {p.sla.alert && !p.decidedAt ? <Icon name="alert" size={12} label={t('admin.moderation.slaAlert')} /> : null}
                              {p.decidedAt ? t('admin.moderation.decided') : p.sla.pct >= 100 ? t('admin.moderation.slaOver') : `${p.sla.pct}% · ${t('admin.moderation.slaLeft', { count: p.sla.hoursLeft })}`}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.cellStack}>
                            <span>{t(`admin.moderation.reviewType.${p.reviewType}`)}</span>
                            <span className={styles.cellMeta}>{p.reviewReason}</span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[p.status]}>{t(`admin.moderation.status.${p.status}`)}</Badge>
                        </td>
                        <td className={styles.num}>
                          <Button variant="soft" size="small" iconRight="chevronRight" onClick={() => navigate(p.id)}>
                            {t('admin.moderation.open')}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <PanelEmpty icon="shield" title={t('admin.moderation.empty')} />
          )}
          <Panel tone="quiet" title={t('admin.moderation.pipeline')} icon="route" labelledBy="pipeline-title">
            <div className={styles.pipeline}>
              <div className={styles.pipeStep}>
                <span className={panelStyles.label}>{t('admin.moderation.autoTriage')}</span>
                <div className={styles.chips}>
                  {data.pipeline.autoTriage.map((x) => (
                    <Chip key={x} tone="neutral">
                      {x}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className={styles.pipeStep}>
                <span className={panelStyles.label}>{t('admin.moderation.integral')}</span>
                <div className={styles.chips}>
                  {data.pipeline.integralReview.map((x) => (
                    <Chip key={x} tone="brand">
                      {x}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className={styles.pipeStep}>
                <span className={panelStyles.label}>{t('admin.moderation.sample')}</span>
                <div className={styles.chips}>
                  <Chip tone="neutral">{data.pipeline.sampleReview}</Chip>
                </div>
              </div>
              <div className={styles.pipeStep}>
                <span className={panelStyles.label}>{t('admin.moderation.sla')}</span>
                <div className={styles.chips}>
                  <Chip tone="brand" icon="clock">
                    {t('admin.moderation.slaValues', { premium: data.pipeline.sla.premium, free: data.pipeline.sla.free })}
                  </Chip>
                  <Chip tone="warning" icon="alert">
                    {t('admin.moderation.alertAt', { pct: data.pipeline.alertAtPct })}
                  </Chip>
                </div>
              </div>
            </div>
          </Panel>
        </>
      ) : null}
    </>
  )
}

export { RISK_TONE, STATUS_TONE, fmtDateTime }
