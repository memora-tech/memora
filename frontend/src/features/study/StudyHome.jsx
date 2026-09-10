import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import styles from './study.module.css'
import { Badge, Banner, Button, EmptyState, Icon, ProgressBar, Skeleton, Stepper, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { useLongPress } from '../../hooks/useLongPress.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDate } from '../../lib/format.js'
import { NoaCard } from './NoaCard.jsx'
import { NoaPresence } from './NoaPresence.jsx'

function PlanOfDay({ today, onClose }) {
  const t = useT()
  const study = useStudy()
  const plan = today.plan || []

  const move = (deckId, dir) => {
    const order = plan.map((p) => p.deckId)
    const i = order.indexOf(deckId)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    study.updatePlan({ order }).catch(() => {})
  }

  const adjust = (deckId, count) => study.updatePlan({ adjustments: { [deckId]: count } }).catch(() => {})

  return (
    <div className={styles.plan} id="plano-do-dia">
      <p className={styles.summaryHint}>{t('study.home.planHint')}</p>
      {plan.map((p, i) => (
        <div key={p.deckId} className={styles.planRow}>
          <div>
            <div className={styles.planName}>
              {p.deckName}
              {p.difficult ? <Badge tone="warning">{t('study.home.planTags.difficult')}</Badge> : null}
              {p.focus ? <Badge tone="brand">{t('study.home.planTags.focus')}</Badge> : null}
              {p.complementary ? <Badge>{t('study.home.planTags.complementary')}</Badge> : null}
            </div>
            <div className={styles.planMeta}>{t('study.home.planAvailable', { count: p.available })}</div>
          </div>
          <div className={styles.planControls}>
            <span className={styles.planMove}>
              <Button variant="ghost" icon="chevronUp" size="small" label={t('study.home.planMoveUp', { deck: p.deckName })} disabled={i === 0} onClick={() => move(p.deckId, -1)} />
              <Button variant="ghost" icon="chevronDown" size="small" label={t('study.home.planMoveDown', { deck: p.deckName })} disabled={i === plan.length - 1} onClick={() => move(p.deckId, 1)} />
            </span>
            <Stepper value={p.count} min={0} max={p.available} onChange={(v) => adjust(p.deckId, v)} label={p.deckName} />
          </div>
        </div>
      ))}
      <div className={styles.stateActions}>
        <Button variant="text" size="small" icon="refresh" onClick={() => study.updatePlan({ reset: true }).catch(() => {})}>
          {t('study.home.planReset')}
        </Button>
        <Button variant="text" size="small" onClick={onClose}>
          {t('study.home.planCollapse')}
        </Button>
      </div>
    </div>
  )
}

export function StudyHome() {
  const t = useT()
  const session = useSession()
  const study = useStudy()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { openPause } = useOutletContext()
  const [planOpen, setPlanOpen] = useState(false)
  const [resumeSummary, setResumeSummary] = useState(null)
  const autoStarted = useRef(false)
  useDocumentTitle(t('study.home.todayTitle'))

  const today = study.today

  const start = () => {
    if (study.start({ mode: 'today' })) navigate('/app/estudar')
    else study.loadToday()
  }

  useEffect(() => {
    if (params.get('acao') === 'comecar' && today?.cards?.length && !study.active && !autoStarted.current) {
      autoStarted.current = true
      setParams({}, { replace: true })
      start()
    }
  }, [params, today, study.active])

  const notToday = async () => {
    try {
      const s = await study.skipToday()
      toast.show({ message: t('study.home.skippedToast', { used: s.reschedules.used, limit: s.reschedules.limit }), icon: 'calendar', action: { label: t('common.actions.undo'), onClick: () => study.undoSkip().catch(() => {}) }, duration: 5000 })
    } catch (err) {
      toast.show({ message: err.code === 'reschedule_limit' ? t('study.home.skipLimit') : err.message, tone: 'danger' })
    }
  }

  const holdHandlers = useLongPress({ onLongPress: openPause, onTap: notToday })

  const resume = async () => {
    try {
      const data = await study.resume()
      setResumeSummary(data.summary)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const name = session.user?.name?.split(' ')[0] || ''

  return (
    <div className={styles.home}>
      <p className={styles.greeting}>{t('study.home.greeting', { name })}</p>

      {study.loading && !today ? (
        <Surface>
          <Skeleton height={28} width="60%" />
          <div style={{ height: 12 }} />
          <Skeleton height={64} />
        </Surface>
      ) : null}

      {study.error && !today ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => study.loadToday()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}

      {study.cached && today ? (
        <Banner tone="neutral" icon="wifiOff">
          {today.plan?.length ? t('study.home.offlineText', { decks: today.plan.map((p) => p.deckName).join(', ') }) : t('study.home.offlineNone')}
        </Banner>
      ) : null}

      {resumeSummary ? (
        <NoaCard title={t('study.home.resumeSummary', { days: resumeSummary.pausedDays })} body={resumeSummary.message} onDismiss={() => setResumeSummary(null)} compact />
      ) : null}

      {today?.status === 'pausado' ? (
        <Surface tone="brand" className={styles.stateCard}>
          <h2 className={styles.stateTitle}>{t('study.home.paused', { date: fmtDate(today.pausedUntil) })}</h2>
          <p className={styles.stateText}>{t('study.home.pausedText')}</p>
          <div className={styles.stateActions}>
            <Button icon="play" onClick={resume}>
              {t('study.home.resume')}
            </Button>
          </div>
        </Surface>
      ) : null}

      {today?.status === 'reagendado' ? (
        <Surface tone="brand" className={styles.stateCard}>
          <h2 className={styles.stateTitle}>{t('study.home.rescheduled')}</h2>
          <p className={styles.stateText}>{t('study.home.rescheduledMeta', { used: today.reschedules.used, limit: today.reschedules.limit })}</p>
          <div className={styles.stateActions}>
            <Button variant="ghost" onClick={() => study.undoSkip().catch(() => {})}>
              {t('study.home.rescheduledUndo')}
            </Button>
            {today.cards?.length ? (
              <Button variant="soft" onClick={start}>
                {t('study.home.studyAnyway')}
              </Button>
            ) : null}
          </div>
        </Surface>
      ) : null}

      {today?.status === 'sem_cards' ? (
        <Surface>
          <EmptyState
            icon="book"
            title={t('study.home.noCards')}
            text={t('study.home.noCardsText')}
            action={
              <div className={styles.stateActions}>
                <Button icon="plus" to="/app/criar">
                  {t('study.home.createDeck')}
                </Button>
                <Button variant="ghost" icon="users" to="/app/comunidade">
                  {t('study.home.explore')}
                </Button>
              </div>
            }
          />
        </Surface>
      ) : null}

      {today?.status === 'concluido' ? (
        <Surface tone="brand" className={styles.stateCard}>
          <h2 className={styles.stateTitle}>{t('study.home.done')}</h2>
          <p className={styles.stateText}>{t('study.home.doneText')}</p>
          <div className={styles.stateActions}>
            <Button variant="soft" icon="users" to="/app/comunidade">
              {t('study.home.explore')}
            </Button>
          </div>
        </Surface>
      ) : null}

      {today?.status === 'pronto' ? (
        <Surface className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <h1 className={styles.summaryTitle}>{t('study.home.summary', { cards: t('common.units.cards', { count: today.cardsDue }), minutes: t('common.units.minutes', { count: today.estimatedMinutes }) })}</h1>
            {today.doneToday > 0 ? <span className={styles.summaryHint}>{t('study.home.goalProgress', { done: today.doneToday, goal: today.goal })}</span> : null}
          </div>

          <div className={styles.actions}>
            <Button size="large" className={styles.startBtn} icon="play" onClick={start} data-testid="btn-comecar">
              {t('study.home.start')}
            </Button>
            <Button variant="ghost" className={styles.notToday} {...holdHandlers} aria-describedby="hoje-nao-hint">
              {t('study.home.notToday')}
            </Button>
            <p id="hoje-nao-hint" className={styles.notTodayHint}>
              {t('study.goal.rescheduleMeta', { used: today.reschedules.used, limit: today.reschedules.limit })}
            </p>
          </div>

          {today.doneToday > 0 ? <ProgressBar value={today.doneToday} max={today.goal} thin label={t('study.home.goalProgress', { done: today.doneToday, goal: today.goal })} /> : null}

          <button type="button" className={styles.planToggle} onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen ? 'true' : 'false'} aria-controls="plano-do-dia">
            <Icon name="list" size={16} />
            {planOpen ? t('study.home.planCollapse') : t('study.home.planOpen', { count: today.plan?.length ?? 0 })}
            <Icon name="chevronDown" size={16} className={styles.summaryChevron} data-open={planOpen ? 'true' : 'false'} />
          </button>
          {planOpen ? <PlanOfDay today={today} onClose={() => setPlanOpen(false)} /> : null}
        </Surface>
      ) : null}

      {today ? <NoaPresence /> : null}
    </div>
  )
}
