import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import styles from './study.module.css'
import { Badge, Banner, Button, EmptyState, Icon, Panel, ProgressBar, Screen, ScreenHeader, Skeleton, StatRow, StatTile, Stepper, Surface, TargetRing, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { useLongPress } from '../../hooks/useLongPress.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDate, fmtNumber, fmtRelative } from '../../lib/format.js'
import { NoaCard } from './NoaCard.jsx'
import { McpArrivalAlert } from '../mcp/McpArrivalAlert.jsx'
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

function ScheduledDecks({ today, onStudyDeck }) {
  const t = useT()
  const decks = today.scheduledDecks || []
  return (
    <section className={styles.scheduled} aria-labelledby="sec-programados">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="sec-programados" className={styles.sectionTitle}>
            {t('study.home.scheduled.title')}
          </h2>
          <p className={styles.sectionLead}>{t('study.home.scheduled.lead', { count: decks.length })}</p>
        </div>
        <Button variant="ghost" icon="settings" to="/app/decks">
          {t('study.home.scheduled.manage')}
        </Button>
      </div>
      {decks.length ? (
        <div className={styles.scheduledGrid}>
          {decks.map((d) => {
            const pct = d.total ? Math.round((d.mastered / d.total) * 100) : 0
            return (
              <article key={d.id} className={styles.scheduledCard} data-today={d.today > 0 ? 'true' : 'false'}>
                <div className={styles.scheduledTop}>
                  <Link to={`/app/decks/${d.id}`} className={styles.scheduledName}>
                    {d.name}
                  </Link>
                  {d.today > 0 ? <Badge tone="brand">{t('study.home.scheduled.today', { count: d.today })}</Badge> : <Badge tone="success" icon="check">{t('study.home.scheduled.upToDate')}</Badge>}
                </div>
                <span className={styles.scheduledMeta}>
                  {d.categoryName} · {t('common.difficulty.' + d.difficulty)}
                  {d.difficult ? ` · ${t('study.home.planTags.difficult')}` : ''}
                  {d.focus ? ` · ${t('study.home.planTags.focus')}` : ''}
                </span>
                <div className={styles.scheduledProgress}>
                  <ProgressBar value={d.mastered} max={d.total || 1} thin label={t('study.home.scheduled.mastered', { mastered: d.mastered, total: d.total })} />
                  <span className={styles.scheduledMeta}>
                    {t('study.home.scheduled.mastered', { mastered: d.mastered, total: d.total })} · {pct}%
                  </span>
                </div>
                <div className={styles.scheduledFoot}>
                  <span className={styles.scheduledMeta}>
                    {d.today > 0 ? t('study.home.scheduled.dueNow', { count: d.dueNow }) : d.nextDue ? t('study.home.scheduled.next', { when: fmtRelative(d.nextDue) }) : t('study.home.scheduled.noCards')}
                  </span>
                  {d.today > 0 ? (
                    <Button size="small" variant="soft" icon="play" onClick={() => onStudyDeck(d)} label={t('study.home.scheduled.studyDeck', { name: d.name })}>
                      {t('study.home.scheduled.study')}
                    </Button>
                  ) : (
                    <Button size="small" variant="ghost" to={`/app/decks/${d.id}`}>
                      {t('study.home.scheduled.open')}
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <Surface>
          <EmptyState icon="calendar" title={t('study.home.scheduled.emptyTitle')} text={t('study.home.scheduled.emptyText')} action={<Button icon="folder" to="/app/decks">{t('study.home.scheduled.pick')}</Button>} />
        </Surface>
      )}
      {today.unscheduledCount ? <p className={styles.sectionLead}>{t('study.home.scheduled.unscheduled', { count: today.unscheduledCount })}</p> : null}
    </section>
  )
}

export function StudyHome() {
  const t = useT()
  const session = useSession()
  const study = useStudy()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { openPause, openGoalMenu } = useOutletContext()
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

  const studyDeck = (deck) => {
    const cards = (today?.cards || []).filter((c) => c.deckId === deck.id)
    if (study.start({ mode: 'deck', deckId: deck.id, deckName: deck.name, cards })) navigate('/app/estudar')
  }

  const objective = today?.nearestObjective

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('study.home.eyebrow')}
        title={t('study.home.greeting', { name })}
        lead={t('study.home.lead')}
        actions={
          <Button variant="soft" icon="plus" to="/app/criar">
            {t('common.nav.create')}
          </Button>
        }
      />

      <McpArrivalAlert />

      {today ? (
        <StatRow>
          <StatTile icon="book" tone="ink" label={t('study.home.stats.today')} value={today.cardsDue} note={t('study.home.stats.todayNote', { count: today.plan?.length || 0 })} />
          <button type="button" className={styles.goalTile} onClick={openGoalMenu} aria-label={`${t('study.home.stats.goal')}: ${t('study.home.stats.goalValue', { done: today.doneToday, goal: today.goal })}. ${t('study.home.stats.goalAction')}`}>
            <TargetRing value={today.doneToday} max={today.goal} size={64} center={today.doneToday} tone={today.doneToday >= today.goal ? 'success' : 'brand'} />
            <span className={styles.goalTileBody}>
              <span className={styles.goalTileLabel}>{t('study.home.stats.goal')}</span>
              <span className={styles.goalTileValue}>{t('study.home.stats.goalValue', { done: today.doneToday, goal: today.goal })}</span>
              <span className={styles.goalTileAction}>{t('study.home.stats.goalAction')}</span>
            </span>
          </button>
          <StatTile icon="flame" tone="reward" label={t('study.home.stats.streak')} value={today.streak} note={t('study.home.stats.streakNote')} />
          <StatTile icon="calendar" label={t('study.home.stats.objective')} value={objective ? t('study.home.stats.objectiveDays', { count: objective.daysLeft, days: objective.daysLeft }) : '—'} note={objective ? objective.name : t('study.home.stats.noObjective')} />
          <StatTile icon="neuron" tone="reward" label={t('study.home.stats.neurons')} value={fmtNumber(today.balance)} note={t('study.home.stats.neuronsNote')} />
        </StatRow>
      ) : null}

      <div className={styles.homeLayout}>
        <div className={styles.homeMain}>

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
                <h2 className={styles.summaryTitle}>{t('study.home.summary', { cards: t('common.units.cards', { count: today.cardsDue }), minutes: t('common.units.minutes', { count: today.estimatedMinutes }) })}</h2>
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

          {today ? <ScheduledDecks today={today} onStudyDeck={studyDeck} /> : null}
        </div>
        <aside className={styles.homeAside} aria-label={t('study.home.asideLabel')}>
          {today ? <NoaPresence /> : null}
          <Panel title={t('study.home.shortcuts.title')} icon="zap" labelledBy="atalhos">
            <ul className={styles.shortcutList}>
              <li>
                <Link to="/app/decks" className={styles.shortcut}>
                  <Icon name="folder" size={18} />
                  <span>{t('study.home.shortcuts.decks')}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/app/comunidade" className={styles.shortcut}>
                  <Icon name="users" size={18} />
                  <span>{t('study.home.shortcuts.community')}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/app/noa" className={styles.shortcut}>
                  <Icon name="sparkle" size={18} />
                  <span>{t('study.home.shortcuts.noa')}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
              <li>
                <Link to="/app/perfil/objetivos" className={styles.shortcut}>
                  <Icon name="target" size={18} />
                  <span>{t('study.home.shortcuts.objectives')}</span>
                  <Icon name="chevronRight" size={16} />
                </Link>
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </Screen>
  )
}
