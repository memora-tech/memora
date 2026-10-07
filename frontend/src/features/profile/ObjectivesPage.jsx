import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './profile.module.css'
import { Badge, Banner, Button, Chip, EmptyState, Screen, ScreenHeader, Sheet, Skeleton, Surface, TargetRing, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { ObjectiveSheet } from '../study/ObjectiveSheet.jsx'

const DAY = 86400000

function journey(o) {
  const start = new Date(o.createdAt || o.date).getTime()
  const total = Math.max(1, Math.round((new Date(o.date).getTime() - start) / DAY))
  const elapsed = Math.min(total, Math.max(0, total - o.daysLeft))
  return { total, elapsed, pct: Math.round((elapsed / total) * 100) }
}

function urgency(o) {
  if (o.daysLeft <= 7) return 'reward'
  if (o.daysLeft <= 30) return 'brand'
  return 'success'
}

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
  const next = upcoming[0]
  const others = upcoming.slice(1)

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

  const daysText = (o) => (o.daysLeft === 0 ? t('profile.objectives.today') : t('profile.objectives.daysLeft', { count: o.daysLeft }))

  return (
    <Screen>
      <ScreenHeader
        crumbs={[{ label: t('profile.title'), to: '/app/perfil' }, { label: t('profile.objectives.title') }]}
        eyebrow={t('profile.objectives.eyebrow')}
        title={t('profile.objectives.title')}
        lead={t('profile.objectives.lead')}
        actions={
          <Button icon="plus" onClick={() => setAddOpen(true)}>
            {t('profile.objectives.add')}
          </Button>
        }
      />

      {list.loading && !list.data ? <Skeleton height={120} count={2} /> : null}
      {list.error && !list.data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => list.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {list.data && !objectives.length ? (
        <Surface>
          <EmptyState icon="target" title={t('profile.objectives.empty')} text={t('profile.objectives.emptyText')} action={<Button icon="plus" onClick={() => setAddOpen(true)}>{t('profile.objectives.add')}</Button>} />
        </Surface>
      ) : null}

      {next ? (
        <section className={styles.nextObjective} aria-labelledby="proxima-prova" data-tone={urgency(next)}>
          <TargetRing value={journey(next).elapsed} max={journey(next).total} size={168} center={next.daysLeft} caption={t('profile.objectives.ringCaption', { count: next.daysLeft })} tone={urgency(next)} />
          <div className={styles.nextBody}>
            <span className={styles.nextEyebrow}>{t('profile.objectives.next')}</span>
            <h2 id="proxima-prova" className={styles.nextName}>
              {next.name} {next.priority ? <Badge tone="noa">{t('profile.objectives.priority')}</Badge> : null}
            </h2>
            <p className={styles.nextMeta}>
              {fmtDate(next.date)} · {daysText(next)}
              {next.daysLeft <= 7 ? ` · ${t('profile.objectives.lastWeek')}` : ''}
            </p>
            <div className={styles.journey}>
              <span className={styles.journeyBar} aria-hidden="true">
                <span style={{ width: `${journey(next).pct}%` }} />
              </span>
              <span className={styles.meta}>{t('profile.objectives.journey', { pct: journey(next).pct, elapsed: journey(next).elapsed, total: journey(next).total })}</span>
            </div>
            {next.subjects?.length ? (
              <div className={styles.subjects}>
                <span className={styles.meta}>{t('profile.objectives.subjectsLabel')}</span>
                {next.subjects.map((s) => (
                  <Chip key={s} tone="brand" icon="layers">
                    {s}
                  </Chip>
                ))}
              </div>
            ) : null}
            <div className={styles.nextActions}>
              <Button icon="play" to="/app">
                {t('profile.objectives.studyNow')}
              </Button>
              <Button variant="ghost" icon="folder" to="/app/decks">
                {t('profile.objectives.pickDecks')}
              </Button>
              <Button variant="text" icon="trash" onClick={() => remove(next)} label={`${t('profile.objectives.delete')} ${next.name}`} />
            </div>
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section className={styles.section} aria-labelledby="proximas">
          <h2 id="proximas" className={styles.sectionTitle}>
            {t('profile.objectives.upcoming')}
          </h2>
          <ul className={styles.objectiveGrid}>
            {others.map((o) => {
              const j = journey(o)
              return (
                <li key={o.id} className={styles.objectiveCard}>
                  <TargetRing value={j.elapsed} max={j.total} size={84} center={o.daysLeft} caption={t('profile.objectives.ringShort')} tone={urgency(o)} />
                  <div className={styles.objectiveBody}>
                    <span className={styles.rowTitle}>
                      {o.name} {o.priority ? <Badge tone="noa">{t('profile.objectives.priority')}</Badge> : null}
                    </span>
                    <span className={styles.meta}>
                      {fmtDate(o.date)} · {daysText(o)}
                    </span>
                    {o.subjects?.length ? <span className={styles.meta}>{t('profile.objectives.subjects', { subjects: o.subjects.join(', ') })}</span> : null}
                  </div>
                  <Button size="small" variant="text" icon="trash" label={`${t('profile.objectives.delete')} ${o.name}`} onClick={() => remove(o)} />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {past.length ? (
        <section className={styles.section} aria-labelledby="passadas">
          <h2 id="passadas" className={styles.sectionTitle}>
            {t('profile.objectives.past')}
          </h2>
          <ul className={styles.objectiveGrid}>
            {past.map((o) => (
              <li key={o.id} className={styles.objectiveCard} data-past="true">
                <TargetRing value={o.outcome === 'aprovado' ? 1 : 0} max={1} size={64} center={o.outcome === 'aprovado' ? '✓' : o.outcome ? '–' : '?'} tone={o.outcome === 'aprovado' ? 'success' : 'muted'} />
                <div className={styles.objectiveBody}>
                  <span className={styles.rowTitle}>{o.name}</span>
                  <span className={styles.meta}>{fmtDate(o.date)}</span>
                  {o.outcome ? <Chip tone={o.outcome === 'aprovado' ? 'success' : 'neutral'}>{t(`profile.objectives.outcome.${o.outcome}`)}</Chip> : null}
                  {o.outcomeRewarded ? <Chip tone="reward" icon="neuron">{t('profile.objectives.rewarded')}</Chip> : null}
                </div>
                {!o.outcome ? (
                  <Button size="small" variant="soft" onClick={() => setOutcomeFor(o)}>
                    {t('profile.objectives.howWas')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className={styles.meta}>
        {t('profile.objectives.goalHint')} <Link to="/app">{t('profile.objectives.goalLink')}</Link>
      </p>

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
    </Screen>
  )
}
