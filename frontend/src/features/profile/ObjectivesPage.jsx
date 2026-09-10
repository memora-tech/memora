import { useState } from 'react'
import styles from './profile.module.css'
import { Badge, Banner, Button, Chip, EmptyState, PageHeader, Sheet, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { ObjectiveSheet } from '../study/ObjectiveSheet.jsx'

export function ObjectivesPage() {
  const t = useT()
  const toast = useToast()
  const study = useStudy()
  const list = useAsync(() => studentApi.get('/objectives'), [])
  const [addOpen, setAddOpen] = useState(false)
  const [outcomeFor, setOutcomeFor] = useState(null)
  useDocumentTitle(t('profile.objectives.title'))
  const objectives = list.data?.objectives || []
  const upcoming = objectives.filter((o) => !o.past)
  const past = objectives.filter((o) => o.past)

  const remove = async (o) => {
    try {
      await studentApi.del(`/objectives/${o.id}`)
      toast.show({ message: t('profile.objectives.deleted') })
      list.run()
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const sendOutcome = async (outcome) => {
    try {
      const data = await studentApi.post(`/objectives/${outcomeFor.id}/outcome`, { outcome })
      if (data.reward) window.dispatchEvent(new CustomEvent('memora:reward', { detail: { rewards: [data.reward], balance: data.balance } }))
      if (data.badge) toast.show({ message: `${data.badge.label}. ${data.badge.note}`, icon: 'trophy', duration: 7000 })
      setOutcomeFor(null)
      list.run()
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const Row = ({ o }) => (
    <div className={styles.row}>
      <div className={styles.rowBody}>
        <span className={styles.rowTitle}>
          {o.name} {o.priority ? <Badge tone="noa">{t('profile.objectives.priority')}</Badge> : null}
        </span>
        <span className={styles.meta}>
          {fmtDate(o.date)} · {o.past ? (o.outcome ? t(`profile.objectives.outcome.${o.outcome}`) : t('profile.objectives.howWas')) : o.daysLeft === 0 ? t('profile.objectives.today') : t('profile.objectives.daysLeft', { count: o.daysLeft })}
          {!o.past && o.daysLeft <= 7 ? ` · ${t('profile.objectives.lastWeek')}` : ''}
        </span>
        {o.subjects?.length ? <span className={styles.meta}>{t('profile.objectives.subjects', { subjects: o.subjects.join(', ') })}</span> : null}
        {o.outcomeRewarded ? <Chip tone="reward" icon="neuron">{t('profile.objectives.rewarded')}</Chip> : null}
      </div>
      {o.past && !o.outcome ? (
        <Button size="small" variant="soft" onClick={() => setOutcomeFor(o)}>
          {t('profile.objectives.howWas')}
        </Button>
      ) : (
        <Button size="small" variant="text" icon="trash" label={`${t('profile.objectives.delete')} ${o.name}`} onClick={() => remove(o)} />
      )}
    </div>
  )

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.objectives.title')} backTo="/app/perfil" actions={<Button size="small" icon="plus" label={t('profile.objectives.add')} onClick={() => setAddOpen(true)} />} />
      {list.loading && !list.data ? <Skeleton height={64} count={3} /> : null}
      {list.error && !list.data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => list.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {list.data && !objectives.length ? (
        <Surface>
          <EmptyState icon="target" title={t('profile.objectives.empty')} action={<Button icon="plus" onClick={() => setAddOpen(true)}>{t('profile.objectives.add')}</Button>} />
        </Surface>
      ) : null}
      {upcoming.length ? (
        <Surface>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 8 }}>
            {t('profile.objectives.upcoming')}
          </h2>
          {upcoming.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </Surface>
      ) : null}
      {past.length ? (
        <Surface tone="sunken">
          <h2 className={styles.sectionTitle} style={{ marginBottom: 8 }}>
            {t('profile.objectives.past')}
          </h2>
          {past.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </Surface>
      ) : null}

      <ObjectiveSheet open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => list.run()} />

      <Sheet open={Boolean(outcomeFor)} onClose={() => setOutcomeFor(null)} title={t('study.done.howWasTitle', { name: outcomeFor?.name || '' })}>
        <p className={styles.meta}>{t('study.done.howWasHint')}</p>
        <div className={styles.actions}>
          {['aprovado', 'reprovado', 'aguardando', 'nao_fiz'].map((o) => (
            <Button key={o} variant={o === 'aprovado' ? 'primary' : 'ghost'} onClick={() => sendOutcome(o)}>
              {t(`study.done.outcomes.${o}`)}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
