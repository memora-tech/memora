import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Badge, Chip, ProgressBar, Segmented, Surface, SectionTitle, EmptyState, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative, fmtDateTime } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData } from './adminSession.js'

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
  const [filter, setFilter] = useState('pending')
  useDocumentTitle(t('admin.moderation.title'))
  const state = useAdminData(() => adminApi.get('/admin/moderation/queue'))
  const data = state.data
  const queue = (data?.queue || []).filter((p) => (filter === 'pending' ? !p.decidedAt : filter === 'decided' ? Boolean(p.decidedAt) : true))

  return (
    <>
      <h1 className={styles.title}>{t('admin.moderation.title')}</h1>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <Surface tone="brand">
            <SectionTitle as="h2">{t('admin.moderation.pipeline')}</SectionTitle>
            <div className={styles.grid2}>
              <div className={styles.stack}>
                <span className={styles.cellMeta}>{t('admin.moderation.autoTriage')}</span>
                <div className={styles.chips}>
                  {data.pipeline.autoTriage.map((x) => (
                    <Chip key={x} tone="neutral">
                      {x}
                    </Chip>
                  ))}
                </div>
                <span className={styles.cellMeta}>{t('admin.moderation.integral')}</span>
                <div className={styles.chips}>
                  {data.pipeline.integralReview.map((x) => (
                    <Chip key={x} tone="brand">
                      {x}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className={styles.stack}>
                <span className={styles.cellMeta}>{t('admin.moderation.sample')}</span>
                <Chip tone="neutral">{data.pipeline.sampleReview}</Chip>
                <span className={styles.cellMeta}>{t('admin.moderation.sla')}</span>
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
          </Surface>
          <div className={styles.toolbar}>
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
          </div>
          {queue.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>{t('admin.moderation.caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.moderation.deck')}</th>
                    <th scope="col">{t('admin.moderation.plan')}</th>
                    <th scope="col">{t('admin.moderation.risk')}</th>
                    <th scope="col">{t('admin.moderation.slaColumn')}</th>
                    <th scope="col">{t('admin.moderation.review')}</th>
                    <th scope="col">{t('admin.common.status')}</th>
                    <th scope="col">{t('admin.common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">
                        <div className={styles.cellStack}>
                          <span>
                            {p.kind === 'material' ? <Badge tone="brand">{t(`admin.moderation.kind.${p.materialKind}`)}</Badge> : null} {p.deckName} <span className={styles.cellMeta}>{t('admin.moderation.version', { version: p.version })}</span>
                          </span>
                          <span className={styles.cellMeta}>
                            {p.authorName} · {t(p.kind === 'material' ? 'admin.moderation.blocks' : 'admin.moderation.cards', { count: p.cardCount })} · {t('admin.moderation.submitted', { when: fmtRelative(p.submittedAt) })}
                          </span>
                        </div>
                      </th>
                      <td>
                        <Badge tone={p.plan === 'premium' ? 'reward' : 'neutral'}>{t(`admin.plan.${p.plan}`)}</Badge>
                      </td>
                      <td>
                        <div className={styles.cellStack}>
                          <Badge tone={RISK_TONE[p.risk.level]}>{t(`admin.moderation.riskLevel.${p.risk.level}`)}</Badge>
                          <span className={styles.cellMeta}>{t('admin.moderation.riskScore', { score: p.risk.score })}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.slaCell}>
                          <ProgressBar value={p.sla.pct} max={100} tone={slaTone(p.sla)} thin label={t('admin.moderation.slaColumn')} />
                          <span className={styles.cellMeta}>
                            {p.decidedAt ? t('admin.moderation.decided') : p.sla.pct >= 100 ? t('admin.moderation.slaOver') : `${p.sla.pct}% · ${t('admin.moderation.slaLeft', { count: p.sla.hoursLeft })}`}
                            {p.sla.alert && !p.decidedAt ? (
                              <>
                                {' '}
                                <Icon name="alert" size={12} label={t('admin.moderation.slaAlert')} />
                              </>
                            ) : null}
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
                      <td>
                        <Button variant="soft" size="small" iconRight="chevronRight" onClick={() => navigate(p.id)}>
                          {t('admin.moderation.open')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="shield" title={t('admin.moderation.empty')} />
          )}
        </>
      ) : null}
    </>
  )
}

export { RISK_TONE, STATUS_TONE, fmtDateTime }
