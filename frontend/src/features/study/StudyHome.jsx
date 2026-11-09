import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import styles from './study.module.css'
import home from './home.module.css'
import { Badge, Banner, Button, EmptyState, Icon, ProgressBar, Screen, ScreenHeader, Skeleton, Stepper, Surface, TargetRing, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { useLongPress } from '../../hooks/useLongPress.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDate, fmtRelative } from '../../lib/format.js'
import { NoaCard } from './NoaCard.jsx'
import { McpArrivalAlert } from '../mcp/McpArrivalAlert.jsx'
import { NoaPresence } from './NoaPresence.jsx'
import { CommunityNow } from '../community/CommunityNow.jsx'

const TONES = ['flashcards', 'resumo', 'mapa', 'noticia', 'quiz', 'linha']
const DAY = 86400000

const toneOf = (today, deckId) => {
  const ids = (today.scheduledDecks || []).map((d) => d.id)
  const i = ids.indexOf(deckId)
  return TONES[(i < 0 ? 0 : i) % TONES.length]
}

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
    <Surface className={home.planSurface}>
      <div className={styles.plan} id="plano-do-dia">
        <p className={styles.summaryHint}>{t('study.home.planHint')}</p>
        {plan.map((p, i) => (
          <div key={p.deckId} className={styles.planRow}>
            <div>
              <div className={styles.planName}>
                <span className={home.toneDot} data-tone={toneOf(today, p.deckId)} aria-hidden="true" />
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
    </Surface>
  )
}

function SessionHero({ today, onStart, holdHandlers, planOpen, onTogglePlan }) {
  const t = useT()
  const plan = (today.plan || []).filter((p) => p.count > 0)
  const first = today.cards?.[0]
  const behind = today.cards?.slice(1, 3) || []

  return (
    <section className={home.hero} aria-labelledby="sessao-hoje">
      <div className={home.heroGlow} aria-hidden="true" />
      <div className={home.heroInner}>
        <div className={home.heroMain}>
          <span className={home.heroLabel}>
            <Icon name="zap" size={14} />
            {t('study.home.hero.label')}
          </span>
          <h2 id="sessao-hoje" className={home.heroTitle}>
            {t('study.home.hero.title', { cards: t('common.units.cards', { count: today.cardsDue }) })}
          </h2>
          <ul className={home.heroFacts}>
            <li className={home.heroFact}>
              <Icon name="clock" size={14} />
              <span>{t('common.units.minutes', { count: today.estimatedMinutes })}</span>
            </li>
            <li className={home.heroFact}>
              <Icon name="layers" size={14} />
              <span>{t('study.home.hero.decks', { count: plan.length })}</span>
            </li>
          </ul>

          {plan.length ? (
            <div className={home.mix}>
              <div className={home.mixBar} aria-hidden="true">
                {plan.map((p) => (
                  <span key={p.deckId} className={home.mixSeg} data-tone={toneOf(today, p.deckId)} style={{ flexGrow: p.count }} />
                ))}
              </div>
              <ul className={home.mixLegend} aria-label={t('study.home.hero.composition')}>
                {plan.map((p) => (
                  <li key={p.deckId} className={home.mixItem} aria-label={t('study.home.hero.share', { deck: p.deckName, count: p.count })}>
                    <span className={home.toneDot} data-tone={toneOf(today, p.deckId)} aria-hidden="true" />
                    <span className={home.mixName} aria-hidden="true">
                      {p.deckName}
                    </span>
                    <span className={home.mixCount} aria-hidden="true">
                      {p.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={home.heroActions}>
            <Button size="large" className={home.startBtn} icon="play" onClick={onStart} data-testid="btn-comecar">
              {t('study.home.start')}
            </Button>
            <div className={home.heroSecondary}>
              <Button variant="text" className={home.heroGhost} {...holdHandlers} aria-describedby="hoje-nao-hint">
                {t('study.home.notToday')}
              </Button>
              <button type="button" className={home.heroGhost} onClick={onTogglePlan} aria-expanded={planOpen ? 'true' : 'false'} aria-controls="plano-do-dia">
                <Icon name="list" size={16} />
                {planOpen ? t('study.home.planCollapse') : t('study.home.hero.adjust')}
              </button>
            </div>
          </div>
          <p id="hoje-nao-hint" className={home.heroHint}>
            {t('study.home.notTodayHint')} · {t('study.goal.rescheduleMeta', { used: today.reschedules.used, limit: today.reschedules.limit })}
          </p>
        </div>

        {first ? (
          <figure className={home.peek}>
            {behind.map((c, i) => (
              <span key={c.id} className={home.peekBack} data-depth={i + 1} data-tone={toneOf(today, c.deckId)} aria-hidden="true" />
            ))}
            <div className={home.peekCard} data-tone={toneOf(today, first.deckId)}>
              <figcaption className={home.peekLabel}>
                <span className={home.toneDot} data-tone={toneOf(today, first.deckId)} aria-hidden="true" />
                {t('study.home.hero.firstCard')}
              </figcaption>
              <p className={home.peekText}>{first.front}</p>
              <span className={home.peekAnswer} aria-hidden="true">
                <span />
                <span />
              </span>
              <span className={home.peekDeck}>{t('study.home.hero.fromDeck', { deck: first.deckName })}</span>
            </div>
          </figure>
        ) : null}
      </div>
    </section>
  )
}

function weekOf(today) {
  const studiedToday = today.doneToday > 0
  const pastRun = studiedToday ? Math.max(0, today.streak - 1) : today.streak
  const base = new Date(`${today.date}T12:00:00`)
  return Array.from({ length: 7 }, (_, k) => {
    const back = 6 - k
    const iso = new Date(base.getTime() - back * DAY).toISOString()
    const state = back === 0 ? (studiedToday ? 'done' : 'pending') : back <= pastRun ? 'done' : 'off'
    return { iso, back, state }
  })
}

function RhythmPanel({ today, onGoal }) {
  const t = useT()
  const hit = today.doneToday >= today.goal
  const left = Math.max(0, today.goal - today.doneToday)
  const week = weekOf(today)
  const objective = today.nearestObjective
  let track = 0
  if (objective) {
    const start = new Date(objective.createdAt).getTime()
    const end = new Date(`${objective.date}T12:00:00`).getTime()
    const now = new Date(`${today.date}T12:00:00`).getTime()
    track = end > start ? Math.round(Math.min(1, Math.max(0, (now - start) / (end - start))) * 100) : 100
  }
  const nextStreak = today.doneToday > 0 ? today.streak : today.streak + 1

  return (
    <section className={home.rhythm} aria-labelledby="seu-ritmo">
      <h2 id="seu-ritmo" className={home.srOnly}>
        {t('study.home.pulse.title')}
      </h2>

      <button type="button" className={home.goal} onClick={onGoal} aria-label={`${t('study.home.pulse.goalRing', { done: today.doneToday, goal: today.goal })}. ${t('study.home.stats.goalAction')}`}>
        <TargetRing value={today.doneToday} max={today.goal} size={76} center={today.doneToday} tone={hit ? 'success' : 'brand'} />
        <span className={home.rhythmBody}>
          <span className={home.rhythmLabel}>{t('study.home.stats.goal')}</span>
          <span className={home.rhythmValue}>{t('study.home.stats.goalValue', { done: today.doneToday, goal: today.goal })}</span>
          <span className={home.rhythmNote} data-tone={hit ? 'success' : undefined}>
            {hit ? (
              <>
                <Icon name="check" size={14} />
                {t('study.home.pulse.goalHit')}
              </>
            ) : (
              t('study.home.pulse.goalLeft', { count: left })
            )}
          </span>
        </span>
        <span className={home.rhythmAction}>
          {t('study.home.stats.goalAction')}
          <Icon name="chevronRight" size={14} />
        </span>
      </button>

      <div className={home.streak}>
        <span className={home.flame} aria-hidden="true">
          <Icon name="flame" size={22} />
        </span>
        <span className={home.rhythmBody}>
          <span className={home.rhythmLabel}>{t('study.home.stats.streak')}</span>
          <span className={home.rhythmValue}>{t('study.home.pulse.streak', { count: today.streak })}</span>
          <span className={home.rhythmNote}>{today.doneToday > 0 ? t('study.home.pulse.streakSafe') : t('study.home.pulse.streakPending', { next: t('common.units.days', { count: nextStreak }) })}</span>
        </span>
        <ol className={home.week} aria-label={t('study.home.pulse.week')}>
          {week.map((d) => {
            const day = fmtDate(d.iso, { weekday: 'long' })
            const key = d.state === 'done' ? 'dayDone' : d.state === 'pending' ? 'dayPending' : 'dayOff'
            return (
              <li key={d.iso} className={home.weekDay} data-state={d.state} aria-label={t(`study.home.pulse.${key}`, { day })}>
                <span className={home.weekDot} aria-hidden="true">
                  {d.state === 'done' ? <Icon name="check" size={12} /> : null}
                </span>
                <span className={home.weekLetter} aria-hidden="true">
                  {fmtDate(d.iso, { weekday: 'short' }).replace('.', '').slice(0, 3)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {objective ? (
        <Link to="/app/perfil/objetivos" className={home.exam}>
          <span className={home.examIcon} aria-hidden="true">
            <Icon name="calendar" size={20} />
          </span>
          <span className={home.rhythmBody}>
            <span className={home.rhythmLabel}>{t('study.home.pulse.objective')}</span>
            <span className={home.rhythmValue}>{t('study.home.pulse.objectiveIn', { name: objective.name, count: objective.daysLeft })}</span>
            <span className={home.examTrack}>
              <ProgressBar value={track} max={100} thin label={t('study.home.pulse.objectiveTrack', { pct: track })} />
            </span>
            <span className={home.rhythmNote}>{t('study.home.pulse.objectiveOn', { date: fmtDate(`${objective.date}T12:00:00`, { day: 'numeric', month: 'long' }) })}</span>
          </span>
          <Icon name="chevronRight" size={16} className={home.chev} />
        </Link>
      ) : (
        <Link to="/app/perfil/objetivos" className={home.exam}>
          <span className={home.examIcon} aria-hidden="true">
            <Icon name="target" size={20} />
          </span>
          <span className={home.rhythmBody}>
            <span className={home.rhythmValue}>{t('study.home.pulse.addObjective')}</span>
            <span className={home.rhythmNote}>{t('study.home.pulse.noObjective')}</span>
          </span>
          <Icon name="chevronRight" size={16} className={home.chev} />
        </Link>
      )}
    </section>
  )
}

function TodayQueue({ today, onStudyDeck }) {
  const t = useT()
  const decks = [...(today.scheduledDecks || [])]
  const order = (today.plan || []).map((p) => p.deckId)
  decks.sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

  return (
    <section className={home.block} aria-labelledby="sec-programados">
      <header className={home.blockHead}>
        <div className={home.blockHeadText}>
          <h2 id="sec-programados" className={home.blockTitle}>
            {t('study.home.queue.title')}
          </h2>
          <p className={home.blockLead}>{t('study.home.queue.lead', { count: decks.length })}</p>
        </div>
        <Link to="/app/decks" className={home.blockLink}>
          <Icon name="settings" size={16} />
          {t('study.home.scheduled.manage')}
        </Link>
      </header>

      {decks.length ? (
        <ol className={home.queue}>
          {decks.map((d, i) => {
            const pct = d.total ? Math.round((d.mastered / d.total) * 100) : 0
            const due = d.today > 0
            const tone = toneOf(today, d.id)
            return (
              <li key={d.id} className={home.deck} data-tone={tone} data-due={due ? 'true' : 'false'}>
                <span className={home.deckBadge} aria-hidden="true">
                  {due ? (
                    <>
                      <span className={home.deckBadgeNum}>{d.today}</span>
                      <span className={home.deckBadgeUnit}>{t('study.home.queue.todayUnit')}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={20} />
                      <span className={home.deckBadgeUnit}>{t('study.home.queue.upToDateUnit')}</span>
                    </>
                  )}
                </span>
                <div className={home.deckBody}>
                  <div className={home.deckTop}>
                    <span className={home.deckOrder} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Link to={`/app/decks/${d.id}`} className={home.deckName}>
                      {d.name}
                    </Link>
                    {d.focus ? <Badge tone="brand">{t('study.home.planTags.focus')}</Badge> : null}
                    {d.difficult ? <Badge tone="warning">{t('study.home.planTags.difficult')}</Badge> : null}
                  </div>
                  <span className={home.deckMeta}>
                    {d.categoryName} · {t('common.difficulty.' + d.difficulty)}
                    {' · '}
                    {due ? t('study.home.scheduled.dueNow', { count: d.dueNow }) : d.nextDue ? t('study.home.scheduled.next', { when: fmtRelative(d.nextDue) }) : t('study.home.scheduled.noCards')}
                  </span>
                  <div className={home.deckProgress}>
                    <ProgressBar value={d.mastered} max={d.total || 1} thin label={t('study.home.scheduled.mastered', { mastered: d.mastered, total: d.total })} />
                    <span className={home.deckPct}>
                      {t('study.home.scheduled.mastered', { mastered: d.mastered, total: d.total })} · {t('study.home.queue.masteredPct', { pct })}
                    </span>
                  </div>
                </div>
                {due ? <Button variant="soft" icon="play" className={home.deckPlay} onClick={() => onStudyDeck(d)} label={t('study.home.scheduled.studyDeck', { name: d.name })} /> : <Button variant="ghost" icon="arrowRight" className={home.deckPlay} to={`/app/decks/${d.id}`} label={`${t('study.home.scheduled.open')} ${d.name}`} />}
              </li>
            )
          })}
        </ol>
      ) : (
        <Surface>
          <EmptyState
            icon="calendar"
            title={t('study.home.scheduled.emptyTitle')}
            text={t('study.home.scheduled.emptyText')}
            action={
              <Button icon="folder" to="/app/decks">
                {t('study.home.scheduled.pick')}
              </Button>
            }
          />
        </Surface>
      )}
      {today.unscheduledCount ? (
        <Link to="/app/decks" className={home.unscheduled}>
          <Icon name="folder" size={16} />
          {t('study.home.scheduled.unscheduled', { count: today.unscheduledCount })}
        </Link>
      ) : null}
    </section>
  )
}

function Shortcuts() {
  const t = useT()
  const items = [
    { to: '/app/decks', icon: 'folder', label: t('study.home.shortcuts.decks') },
    { to: '/app/comunidade', icon: 'users', label: t('study.home.shortcuts.community') },
    { to: '/app/noa', icon: 'sparkle', label: t('study.home.shortcuts.noa') },
    { to: '/app/perfil/objetivos', icon: 'target', label: t('study.home.shortcuts.objectives') }
  ]
  return (
    <nav className={home.shortcuts} aria-label={t('study.home.next.shortcutsLabel')}>
      <ul className={home.shortcutGrid}>
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className={home.shortcut}>
              <span className={home.shortcutIcon} aria-hidden="true">
                <Icon name={it.icon} size={18} />
              </span>
              <span className={home.shortcutLabel}>{it.label}</span>
              <Icon name="arrowRight" size={16} className={home.chev} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
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
  const lead = today?.status === 'concluido' ? t('study.home.leadDone') : objective ? t('study.home.leadObjective', { count: objective.daysLeft, name: objective.name }) : t('study.home.leadDefault')
  const dateLabel = fmtDate(today?.date ? `${today.date}T12:00:00` : new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Screen className={home.screen}>
      <ScreenHeader
        eyebrow={t('study.home.eyebrowDate', { date: dateLabel })}
        title={t('study.home.greeting', { name })}
        lead={lead}
        actions={
          <Button variant="soft" icon="plus" to="/app/criar">
            {t('common.nav.create')}
          </Button>
        }
      />

      <McpArrivalAlert />

      {study.loading && !today ? (
        <div className={home.top}>
          <Skeleton height={340} />
          <Skeleton height={340} />
        </div>
      ) : null}

      {study.error && !today ? (
        <Banner
          tone="danger"
          icon="alert"
          action={
            <Button size="small" variant="soft" onClick={() => study.loadToday()}>
              {t('common.actions.retry')}
            </Button>
          }
        >
          {t('common.state.error')}
        </Banner>
      ) : null}

      {study.cached && today ? (
        <Banner tone="neutral" icon="wifiOff">
          {today.plan?.length ? t('study.home.offlineText', { decks: today.plan.map((p) => p.deckName).join(', ') }) : t('study.home.offlineNone')}
        </Banner>
      ) : null}

      {resumeSummary ? <NoaCard title={t('study.home.resumeSummary', { days: resumeSummary.pausedDays })} body={resumeSummary.message} onDismiss={() => setResumeSummary(null)} compact /> : null}

      {today ? (
        <div className={home.top}>
          <div className={home.topMain}>
            {today.status === 'pronto' ? <SessionHero today={today} onStart={start} holdHandlers={holdHandlers} planOpen={planOpen} onTogglePlan={() => setPlanOpen((v) => !v)} /> : null}

            {today.status === 'pausado' ? (
              <Surface tone="brand" className={[styles.stateCard, home.stateCard].join(' ')}>
                <h2 className={styles.stateTitle}>{t('study.home.paused', { date: fmtDate(today.pausedUntil) })}</h2>
                <p className={styles.stateText}>{t('study.home.pausedText')}</p>
                <div className={styles.stateActions}>
                  <Button icon="play" onClick={resume}>
                    {t('study.home.resume')}
                  </Button>
                </div>
              </Surface>
            ) : null}

            {today.status === 'reagendado' ? (
              <Surface tone="brand" className={[styles.stateCard, home.stateCard].join(' ')}>
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

            {today.status === 'sem_cards' ? (
              <Surface className={home.stateCard}>
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

            {today.status === 'concluido' ? (
              <Surface tone="brand" className={[styles.stateCard, home.stateCard, home.doneCard].join(' ')}>
                <span className={home.doneMark} aria-hidden="true">
                  <Icon name="trophy" size={28} />
                </span>
                <h2 className={styles.stateTitle}>{t('study.home.done')}</h2>
                <p className={styles.stateText}>{t('study.home.doneText')}</p>
                <div className={styles.stateActions}>
                  <Button variant="soft" icon="users" to="/app/comunidade">
                    {t('study.home.explore')}
                  </Button>
                </div>
              </Surface>
            ) : null}

            {planOpen && today.status === 'pronto' ? <PlanOfDay today={today} onClose={() => setPlanOpen(false)} /> : null}
          </div>
          <RhythmPanel today={today} onGoal={openGoalMenu} />
        </div>
      ) : null}

      {today ? <TodayQueue today={today} onStudyDeck={studyDeck} /> : null}

      <section className={home.after} aria-labelledby="depois-da-sessao">
        <header className={home.blockHead}>
          <div className={home.blockHeadText}>
            <h2 id="depois-da-sessao" className={home.blockTitle}>
              {t('study.home.next.title')}
            </h2>
            <p className={home.blockLead}>{t('study.home.next.lead')}</p>
          </div>
        </header>
        <div className={home.afterGrid}>
          {today ? <NoaPresence variant="card" /> : null}
          <CommunityNow />
        </div>
        <Shortcuts />
      </section>
    </Screen>
  )
}
