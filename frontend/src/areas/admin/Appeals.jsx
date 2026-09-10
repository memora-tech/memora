import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Segmented, Textarea, Surface, EmptyState, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative, fmtDate, fmtDateTime } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard, getAdminUser } from './adminSession.js'

const STATUS_TONE = { em_analise: 'warning', aceita: 'success', mantida: 'neutral' }

export function Appeals() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  const me = getAdminUser()
  const canDecide = me?.role === 'moderador' || me?.role === 'engenharia'
  const [drafts, setDrafts] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(null)
  useDocumentTitle(t('admin.appeals.title'))

  const state = useAdminData(() => adminApi.get('/admin/moderation/appeals'))
  const appeals = state.data?.appeals || []

  const draft = (id) => drafts[id] || { decision: 'mantida', note: '' }
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...patch } }))

  const decide = async (appeal) => {
    const d = draft(appeal.id)
    setBusy(appeal.id)
    setErrors((e) => ({ ...e, [appeal.id]: null }))
    try {
      const res = await adminApi.post(`/admin/moderation/appeals/${appeal.id}/decide`, { decision: d.decision, note: d.note.trim() || undefined })
      state.setData({ appeals: appeals.map((a) => (a.id === appeal.id ? res.appeal : a)) })
      toast.show({ message: t('admin.appeals.done'), icon: 'check' })
    } catch (err) {
      if (!guard(err)) setErrors((e) => ({ ...e, [appeal.id]: err.code === 'same_reviewer' ? t('admin.appeals.sameReviewer') : err.message }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <h1 className={styles.title}>{t('admin.appeals.title')}</h1>
      <Banner tone="brand" icon="info">
        {t('admin.appeals.intro')}
      </Banner>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {state.data ? (
        appeals.length ? (
          <div className={styles.list}>
            {appeals.map((a) => {
              const d = draft(a.id)
              return (
                <Surface key={a.id} className={styles.stack}>
                  <div className={styles.cardHead}>
                    <div className={styles.stack}>
                      <h2 className={styles.cardTitle}>{a.publicationId}</h2>
                      <div className={styles.metaList}>
                        <span>{a.authorName}</span>
                        <span>{t('admin.appeals.filedAt', { when: fmtRelative(a.filedAt) })}</span>
                        <span>{t('admin.appeals.deadline', { date: fmtDate(a.deadline) })}</span>
                        <span>
                          {t('admin.appeals.reviewer')}: {a.reviewer}
                        </span>
                        <span>
                          {t('admin.appeals.originalReviewer')}: {a.originalReviewer}
                        </span>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[a.status] || 'neutral'}>{t(`admin.appeals.status.${a.status}`)}</Badge>
                  </div>
                  <dl className={styles.definition}>
                    <dt>{t('admin.appeals.text')}</dt>
                    <dd>{a.text}</dd>
                  </dl>
                  {a.status === 'em_analise' && canDecide ? (
                    <div className={styles.form}>
                      <div className={styles.formFull}>
                        <Segmented
                          label={t('admin.appeals.decide')}
                          value={d.decision}
                          onChange={(v) => setDraft(a.id, { decision: v })}
                          options={[
                            { value: 'aceita', label: t('admin.appeals.accept'), icon: 'check' },
                            { value: 'mantida', label: t('admin.appeals.keep'), icon: 'lock' }
                          ]}
                        />
                      </div>
                      <div className={styles.formFull}>
                        <Textarea label={t('admin.appeals.note')} value={d.note} onChange={(e) => setDraft(a.id, { note: e.target.value })} />
                      </div>
                      {d.decision === 'aceita' ? (
                        <p className={`${styles.cellMeta} ${styles.formFull}`}>{t('admin.appeals.acceptedEffect')}</p>
                      ) : null}
                      {errors[a.id] ? (
                        <div className={styles.formFull}>
                          <Banner tone="danger" icon="alert">
                            {errors[a.id]}
                          </Banner>
                        </div>
                      ) : null}
                      <div className={`${styles.formActions} ${styles.formFull}`}>
                        <Button icon="check" onClick={() => decide(a)} loading={busy === a.id}>
                          {t('admin.appeals.submit')}
                        </Button>
                      </div>
                    </div>
                  ) : a.decidedAt ? (
                    <p className={styles.cellMeta}>
                      {t('admin.appeals.decidedBy', { date: fmtDateTime(a.decidedAt) })}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                  ) : null}
                </Surface>
              )
            })}
          </div>
        ) : (
          <EmptyState icon="route" title={t('admin.appeals.empty')} />
        )
      ) : null}
    </>
  )
}
