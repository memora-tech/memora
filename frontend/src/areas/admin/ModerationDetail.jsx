import { useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Badge, Chip, Banner, ProgressBar, Segmented, Select, Textarea, Panel, ScreenHeader, ConfirmDialog, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDateTime, fmtDate, difficultyLabel } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard, getAdminUser } from './adminSession.js'
import { RISK_TONE, STATUS_TONE, slaTone } from './Moderation.jsx'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { PanelEmpty, panelStyles } from '../shared/PanelShell.jsx'

export function ModerationDetail() {
  const t = useT()
  const { id } = useParams()
  const guard = useAdminGuard()
  const toast = useToast()
  const me = getAdminUser()
  const eyebrow = useSectionEyebrow('moderacao')
  const [decision, setDecision] = useState('aprovado')
  const [reasonCategory, setReasonCategory] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const state = useAdminData(() => adminApi.get(`/admin/moderation/${id}`), [id])
  const pub = state.data?.publication
  useDocumentTitle(pub ? pub.deckName : t('admin.moderation.title'))

  const assign = async () => {
    try {
      const res = await adminApi.post(`/admin/moderation/${id}/assign`)
      state.setData({ ...state.data, publication: { ...pub, ...res.publication, snapshot: pub.snapshot } })
      toast.show({ message: t('admin.moderation.detail.assigned'), icon: 'check' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const register = () => {
    if (decision === 'rejeitado' && (!reasonCategory || !excerpt.trim())) {
      setError(t('admin.moderation.detail.validation'))
      return
    }
    setError(null)
    setConfirming(true)
  }

  const decide = async () => {
    setBusy(true)
    try {
      const body = decision === 'rejeitado' ? { decision, reasonCategory, excerpt: excerpt.trim() } : { decision }
      const res = await adminApi.post(`/admin/moderation/${id}/decide`, body)
      state.setData({ ...state.data, publication: { ...pub, ...res.publication, snapshot: pub.snapshot } })
      toast.show({ message: t('admin.moderation.detail.done'), icon: 'check' })
      setConfirming(false)
    } catch (err) {
      setConfirming(false)
      if (!guard(err)) setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {pub ? (
        <>
          <ScreenHeader
            size="compact"
            crumbs={[{ label: t('admin.moderation.detail.back'), to: '/admin/painel/moderacao' }, { label: pub.deckName }]}
            eyebrow={eyebrow}
            title={
              <>
                {pub.deckName} <span className={styles.titleMeta}>{t('admin.moderation.version', { version: pub.version })}</span>
              </>
            }
            lead={
              <span className={styles.metaList}>
                <span>
                  {t('admin.moderation.author')}: {pub.authorName}
                </span>
                <span>{pub.categoryName}</span>
                {pub.kind === 'material' ? (
                  <span>{t(`admin.moderation.kind.${pub.materialKind}`)}</span>
                ) : (
                  <span>
                    {t('admin.moderation.detail.difficulty')}: {difficultyLabel[pub.difficulty] || pub.difficulty}
                  </span>
                )}
                <span>{t(pub.kind === 'material' ? 'admin.moderation.blocks' : 'admin.moderation.cards', { count: pub.cardCount })}</span>
                <span>
                  {t('admin.moderation.detail.submittedAt')} {fmtDateTime(pub.submittedAt)}
                </span>
              </span>
            }
            actions={
              <div className={styles.chips}>
                <Badge tone={pub.plan === 'premium' ? 'reward' : 'neutral'}>{t(`admin.plan.${pub.plan}`)}</Badge>
                <Badge tone={STATUS_TONE[pub.status]}>{t(`admin.moderation.status.${pub.status}`)}</Badge>
              </div>
            }
          />
          <div className={panelStyles.split}>
            <div className={panelStyles.stack}>
              <Panel tone="quiet" title={t('admin.moderation.detail.snapshot')} icon="layers" labelledBy="snapshot-title">
                <p className={styles.cellMeta}>{t('admin.moderation.detail.snapshotNote')}</p>
                <ol className={styles.snapshot}>
                  {(pub.snapshot || []).map((c, i) => (
                    <li key={c.id || i} className={styles.snapCard}>
                      <span className={styles.snapLabel}>
                        {i + 1} · {t('admin.moderation.detail.front')}
                      </span>
                      <span>{c.front}</span>
                      <span className={styles.snapLabel}>{t('admin.moderation.detail.back_')}</span>
                      <span>{c.back}</span>
                    </li>
                  ))}
                </ol>
                {pub.snapshot?.length ? null : <PanelEmpty icon="layers" title={t('admin.pages.moderation.noSnapshot')} />}
              </Panel>
              <Panel tone="quiet" title={t('admin.moderation.detail.decision')} icon="check" labelledBy="decision-title">
                {pub.decidedAt ? (
                  <>
                    <Banner tone={pub.decision.decision === 'aprovado' ? 'success' : 'danger'} icon={pub.decision.decision === 'aprovado' ? 'check' : 'x'}>
                      <strong>{t(`admin.moderation.status.${pub.decision.decision}`)}</strong> · {t('admin.moderation.detail.decisionMade', { date: fmtDateTime(pub.decidedAt), name: pub.decision.byName || pub.decision.by })}
                    </Banner>
                    {pub.decision.reasonCategory ? (
                      <dl className={styles.definition}>
                        <dt>{t('admin.moderation.detail.reasonCategory')}</dt>
                        <dd>{t(`admin.moderation.categories.${pub.decision.reasonCategory}`)}</dd>
                        <dt>{t('admin.moderation.detail.excerpt')}</dt>
                        <dd>{pub.decision.excerpt}</dd>
                        {pub.decision.appealDeadline ? (
                          <>
                            <dt>{t('admin.appeals.title')}</dt>
                            <dd>{t('admin.moderation.detail.appealDeadline', { date: fmtDate(pub.decision.appealDeadline) })}</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                  </>
                ) : (
                  <div className={styles.form}>
                    <div className={styles.formFull}>
                      <Segmented
                        label={t('admin.moderation.detail.decision')}
                        value={decision}
                        onChange={setDecision}
                        options={[
                          { value: 'aprovado', label: t('admin.moderation.detail.approve'), icon: 'check' },
                          { value: 'rejeitado', label: t('admin.moderation.detail.reject'), icon: 'x' }
                        ]}
                      />
                    </div>
                    {decision === 'rejeitado' ? (
                      <>
                        <Select label={t('admin.moderation.detail.reasonCategory')} value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
                          <option value="">{t('admin.moderation.detail.reasonPlaceholder')}</option>
                          {state.data.categories.map((c) => (
                            <option key={c} value={c}>
                              {t(`admin.moderation.categories.${c}`)}
                            </option>
                          ))}
                        </Select>
                        <Textarea label={t('admin.moderation.detail.excerpt')} hint={t('admin.moderation.detail.excerptHint')} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
                      </>
                    ) : null}
                    {error ? (
                      <div className={styles.formFull}>
                        <Banner tone="danger" icon="alert">
                          {error}
                        </Banner>
                      </div>
                    ) : null}
                    <div className={`${styles.formActions} ${styles.formFull}`}>
                      <Button icon="check" onClick={register}>
                        {t('admin.moderation.detail.register')}
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
            <div className={panelStyles.stack}>
              <Panel tone="quiet" title={t('admin.moderation.slaColumn')} icon="clock" labelledBy="sla-title">
                <ProgressBar value={pub.sla.pct} max={100} tone={slaTone(pub.sla)} label={t('admin.moderation.slaColumn')} />
                <span className={styles.slaText} data-tone={slaTone(pub.sla)}>
                  {pub.slaHours} h · {pub.sla.pct}%{pub.sla.dueAt ? ` · ${t('admin.moderation.dueAt', { date: fmtDateTime(pub.sla.dueAt) })}` : ''}
                </span>
                <dl className={styles.definition}>
                  <dt>{t('admin.moderation.detail.assignedTo')}</dt>
                  <dd>{pub.assignedTo || t('admin.moderation.detail.unassigned')}</dd>
                </dl>
                {!pub.decidedAt && pub.assignedTo !== me?.id ? (
                  <div>
                    <Button variant="ghost" size="small" icon="user" onClick={assign}>
                      {t('admin.moderation.detail.assign')}
                    </Button>
                  </div>
                ) : null}
              </Panel>
              <Panel tone="quiet" title={t('admin.moderation.detail.riskFactors')} icon="flag" labelledBy="risk-title">
                <div className={styles.chips}>
                  <Badge tone={RISK_TONE[pub.risk.level]}>{t(`admin.moderation.riskLevel.${pub.risk.level}`)}</Badge>
                  <Chip tone="neutral">{t('admin.moderation.riskScore', { score: pub.risk.score })}</Chip>
                </div>
                <ul className={panelStyles.rules}>
                  {pub.risk.factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className={styles.cellMeta}>{t('admin.moderation.detail.reviewReason', { type: t(`admin.moderation.reviewType.${pub.reviewType}`).toLowerCase(), reason: pub.reviewReason })}</p>
              </Panel>
              <Panel tone="quiet" title={t('admin.moderation.detail.authorHistory')} icon="user" labelledBy="history-title">
                {state.data.authorHistory.length ? (
                  <ul className={styles.stack}>
                    {state.data.authorHistory.map((h) => (
                      <li key={h.id} className={styles.cardHead}>
                        <span>{h.deckName}</span>
                        <Badge tone={STATUS_TONE[h.status]}>{t(`admin.moderation.status.${h.status}`)}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.cellMeta}>{t('admin.moderation.detail.noHistory')}</p>
                )}
              </Panel>
            </div>
          </div>
          <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={decide} title={t('admin.moderation.detail.confirmTitle', { decision: t(`admin.moderation.status.${decision}`).toLowerCase() })} confirmLabel={t(`admin.moderation.detail.${decision === 'aprovado' ? 'approve' : 'reject'}`)} danger={decision === 'rejeitado'} loading={busy}>
            <p>{decision === 'aprovado' ? t('admin.moderation.detail.confirmApprove') : t('admin.moderation.detail.confirmReject')}</p>
          </ConfirmDialog>
        </>
      ) : null}
    </>
  )
}
