import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Badge, Chip, Banner, ProgressBar, Segmented, Select, Textarea, Surface, SectionTitle, ConfirmDialog, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDateTime, fmtDate, difficultyLabel } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard, getAdminUser } from './adminSession.js'
import { RISK_TONE, STATUS_TONE, slaTone } from './Moderation.jsx'

export function ModerationDetail() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const guard = useAdminGuard()
  const toast = useToast()
  const me = getAdminUser()
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
      <div>
        <Button variant="text" icon="arrowLeft" onClick={() => navigate('/admin/painel/moderacao')}>
          {t('admin.moderation.detail.back')}
        </Button>
      </div>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {pub ? (
        <>
          <Surface className={styles.stack}>
            <div className={styles.cardHead}>
              <div className={styles.stack}>
                <h1 className={styles.cardTitle}>
                  {pub.deckName} <span className={styles.cellMeta}>{t('admin.moderation.version', { version: pub.version })}</span>
                </h1>
                <div className={styles.metaList}>
                  <span>
                    {t('admin.moderation.author')}: {pub.authorName}
                  </span>
                  <span>
                    {t('admin.moderation.detail.category')}: {pub.categoryName}
                  </span>
                  {pub.kind === 'material' ? (
                    <span>
                      <Badge tone="brand">{t(`admin.moderation.kind.${pub.materialKind}`)}</Badge>
                    </span>
                  ) : (
                    <span>
                      {t('admin.moderation.detail.difficulty')}: {difficultyLabel[pub.difficulty] || pub.difficulty}
                    </span>
                  )}
                  <span>{t(pub.kind === 'material' ? 'admin.moderation.blocks' : 'admin.moderation.cards', { count: pub.cardCount })}</span>
                  <span>
                    {t('admin.moderation.detail.submittedAt')} {fmtDateTime(pub.submittedAt)}
                  </span>
                </div>
              </div>
              <div className={styles.chips}>
                <Badge tone={pub.plan === 'premium' ? 'reward' : 'neutral'}>{t(`admin.plan.${pub.plan}`)}</Badge>
                <Badge tone={STATUS_TONE[pub.status]}>{t(`admin.moderation.status.${pub.status}`)}</Badge>
              </div>
            </div>
            <div className={styles.slaCell}>
              <ProgressBar value={pub.sla.pct} max={100} tone={slaTone(pub.sla)} label={t('admin.moderation.slaColumn')} />
              <span className={styles.cellMeta}>
                {t('admin.moderation.sla')} {pub.slaHours} h · {pub.sla.pct}%{pub.sla.dueAt ? ` · ${t('admin.moderation.dueAt', { date: fmtDateTime(pub.sla.dueAt) })}` : ''}
              </span>
            </div>
            <div className={styles.metaList}>
              <span>
                {t('admin.moderation.detail.assignedTo')}: {pub.assignedTo || t('admin.moderation.detail.unassigned')}
              </span>
              {!pub.decidedAt && pub.assignedTo !== me?.id ? (
                <Button variant="ghost" size="small" icon="user" onClick={assign}>
                  {t('admin.moderation.detail.assign')}
                </Button>
              ) : null}
            </div>
          </Surface>
          <div className={styles.grid2}>
            <Surface className={styles.stack}>
              <SectionTitle as="h2">{t('admin.moderation.detail.riskFactors')}</SectionTitle>
              <div className={styles.chips}>
                <Badge tone={RISK_TONE[pub.risk.level]}>{t(`admin.moderation.riskLevel.${pub.risk.level}`)}</Badge>
                <Chip tone="neutral">{t('admin.moderation.riskScore', { score: pub.risk.score })}</Chip>
              </div>
              <ul className={styles.stack}>
                {pub.risk.factors.map((f) => (
                  <li key={f} className={styles.cellMeta}>
                    {f}
                  </li>
                ))}
              </ul>
              <p className={styles.cellMeta}>{t('admin.moderation.detail.reviewReason', { type: t(`admin.moderation.reviewType.${pub.reviewType}`).toLowerCase(), reason: pub.reviewReason })}</p>
            </Surface>
            <Surface className={styles.stack}>
              <SectionTitle as="h2">{t('admin.moderation.detail.authorHistory')}</SectionTitle>
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
            </Surface>
          </div>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.moderation.detail.snapshot')}</SectionTitle>
            <p className={styles.cellMeta}>{t('admin.moderation.detail.snapshotNote')}</p>
            <ol className={styles.snapshot}>
              {pub.snapshot.map((c, i) => (
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
          </Surface>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.moderation.detail.decision')}</SectionTitle>
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
          </Surface>
          <ConfirmDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            onConfirm={decide}
            title={t('admin.moderation.detail.confirmTitle', { decision: t(`admin.moderation.status.${decision}`).toLowerCase() })}
            confirmLabel={t(`admin.moderation.detail.${decision === 'aprovado' ? 'approve' : 'reject'}`)}
            danger={decision === 'rejeitado'}
            loading={busy}
          >
            <p>{decision === 'aprovado' ? t('admin.moderation.detail.confirmApprove') : t('admin.moderation.detail.confirmReject')}</p>
          </ConfirmDialog>
        </>
      ) : null}
    </>
  )
}
