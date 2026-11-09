import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Segmented, Textarea, ScreenHeader, StatTile, useToast } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
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
  const eyebrow = useSectionEyebrow('contestacoes')
  const openCount = appeals.filter((a) => a.status === 'em_analise').length
  const acceptedCount = appeals.filter((a) => a.status === 'aceita').length
  const keptCount = appeals.filter((a) => a.status === 'mantida').length

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
      <ScreenHeader size="compact" eyebrow={eyebrow} title={t('admin.appeals.title')} lead={t('admin.appeals.intro')} />
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {state.data ? (
        <div className={panelStyles.kpis}>
          <StatTile size="compact" icon="clock" label={t('admin.pages.appeals.kpiOpen')} value={openCount} note={<Trend tone={openCount ? 'warning' : 'success'}>{t('admin.pages.appeals.noteWindow')}</Trend>} />
          <StatTile size="compact" icon="check" label={t('admin.pages.appeals.kpiAccepted')} value={acceptedCount} />
          <StatTile size="compact" icon="lock" label={t('admin.pages.appeals.kpiKept')} value={keptCount} />
        </div>
      ) : null}
      {state.data ? (
        appeals.length ? (
          <div className={styles.list}>
            {appeals.map((a) => {
              const d = draft(a.id)
              return (
                <article key={a.id} className={styles.card} data-tone={a.status === 'em_analise' ? 'warning' : undefined}>
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
                  <div className={styles.stack}>
                    <span className={panelStyles.label}>{t('admin.appeals.text')}</span>
                    <p className={styles.quote}>{a.text}</p>
                  </div>
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
                      {d.decision === 'aceita' ? <p className={`${styles.cellMeta} ${styles.formFull}`}>{t('admin.appeals.acceptedEffect')}</p> : null}
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
                </article>
              )
            })}
          </div>
        ) : (
          <PanelEmpty icon="route" title={t('admin.appeals.empty')} />
        )
      ) : null}
    </>
  )
}
