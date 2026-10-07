import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import styles from './student.module.css'
import { Icon, NeuronCounter, Wordmark, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { useProto } from '../../state/ProtoContext.jsx'
import { studentApi } from '../../lib/api.js'
import { daysUntil } from '../../lib/format.js'
import { GoalMenuSheet } from '../../features/study/GoalMenuSheet.jsx'
import { ObjectiveSheet } from '../../features/study/ObjectiveSheet.jsx'
import { PauseSheet } from '../../features/study/PauseSheet.jsx'
import { LayoutBanners } from './LayoutBanners.jsx'
import { UserMenu } from './UserMenu.jsx'
import { McpArrivalWatcher } from '../../features/mcp/McpArrivalAlert.jsx'
import { NotificationCard } from '../../features/notifications/NotificationCard.jsx'

const NAV_GROUPS = [
  {
    key: 'study',
    items: [
      { to: '/app', key: 'study', icon: 'book', end: true },
      { to: '/app/decks', key: 'decks', icon: 'folder' },
      { to: '/app/criar', key: 'create', icon: 'plus' }
    ]
  },
  { key: 'community', items: [{ to: '/app/comunidade', key: 'community', icon: 'users' }] },
  { key: 'ai', items: [{ to: '/app/noa', key: 'noa', icon: 'sparkle', badge: 'IA' }] }
]

const WIDE_EXACT = ['/app', '/app/decks', '/app/criar', '/app/perfil', '/app/carteira', '/app/perfil/conexoes']
const WIDE_PREFIX = ['/app/comunidade', '/app/noa', '/app/decks/', '/app/pastas', '/app/perfil/objetivos', '/app/perfil/blog']
const FILL = ['/app/comunidade']

const TABS = [
  { to: '/app', key: 'study', icon: 'book', end: true },
  { to: '/app/decks', key: 'decks', icon: 'folder' },
  { to: '/app/comunidade', key: 'community', icon: 'users' },
  { to: '/app/noa', key: 'noa', icon: 'sparkle' },
  { to: '/app/perfil', key: 'profile', icon: 'user' }
]

function useWalletPeek(isAuthed) {
  const [wallet, setWallet] = useState(null)
  const load = useCallback(async () => {
    try {
      const data = await studentApi.get('/wallet')
      setWallet(data)
    } catch {
      return undefined
    }
    return undefined
  }, [])
  useEffect(() => {
    if (!isAuthed) return undefined
    load()
    const handler = () => load()
    window.addEventListener('memora:reward', handler)
    window.addEventListener('memora:proto-changed', handler)
    window.addEventListener('memora:wallet-changed', handler)
    return () => {
      window.removeEventListener('memora:reward', handler)
      window.removeEventListener('memora:proto-changed', handler)
      window.removeEventListener('memora:wallet-changed', handler)
    }
  }, [isAuthed, load])
  return wallet
}

function ObjectiveLabel({ objective, t }) {
  if (!objective) return t('common.topline.noObjective')
  const days = daysUntil(objective.date)
  if (days === 0) return t('common.topline.objectiveToday', { name: objective.name })
  if (days === 1) return t('common.topline.objectiveTomorrow', { name: objective.name })
  return t('common.topline.objective', { name: objective.name, days })
}

export function StudentLayout() {
  const t = useT()
  const session = useSession()
  const study = useStudy()
  const proto = useProto()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [sheet, setSheet] = useState(null)
  const shownCredits = useRef(new Set())
  const wallet = useWalletPeek(session.isAuthed)
  const focus = study.focus && location.pathname === '/app/estudar'
  const chromeHidden = focus && !study.chromeVisible
  const path = location.pathname.replace(/\/$/, '') || '/app'
  const wide = WIDE_EXACT.includes(path) || WIDE_PREFIX.some((p) => path.startsWith(p))
  const fill = FILL.includes(path)
  const [peek, setPeek] = useState(false)

  useEffect(() => {
    if (focus && !study.chromeVisible && wallet?.redeemable) {
      setPeek(true)
      const timer = setTimeout(() => setPeek(false), 2700)
      return () => clearTimeout(timer)
    }
    setPeek(false)
    return undefined
  }, [focus, study.chromeVisible, wallet?.redeemable])

  useEffect(() => {
    const credit = session.dailyCredit
    if (!credit || shownCredits.current.has(credit.id)) return
    shownCredits.current.add(credit.id)
    toast.show({ message: t('common.reward.dailyAccess'), tone: 'reward', icon: 'neuron' })
    session.markCreditSeen()
  }, [session.dailyCredit, session, toast, t])

  useEffect(() => {
    const onReward = (e) => {
      const rewards = e.detail?.rewards || []
      rewards.forEach((r) => {
        if (r.type === 'goal_bonus') toast.show({ message: t('common.reward.goal', { amount: r.amount }), tone: 'reward', icon: 'neuron' })
        else if (r.type === 'objective_outcome') toast.show({ message: t('common.reward.objective', { amount: r.amount }), tone: 'reward', icon: 'neuron' })
        else if (r.amount > 0) toast.show({ message: t('common.reward.generic', { amount: r.amount }), tone: 'reward', icon: 'neuron' })
      })
      session.refresh()
    }
    const onSynced = (e) => toast.show({ message: t('common.state.synced', { count: e.detail?.flushed || 0 }), icon: 'check' })
    window.addEventListener('memora:reward', onReward)
    window.addEventListener('memora:synced', onSynced)
    return () => {
      window.removeEventListener('memora:reward', onReward)
      window.removeEventListener('memora:synced', onSynced)
    }
  }, [toast, t, session])

  const today = study.today
  const objective = today?.nearestObjective || null
  const streak = today?.streak ?? session.user?.streak ?? 0
  const balance = session.user?.balance ?? today?.balance ?? 0

  const outletContext = useMemo(
    () => ({
      openGoalMenu: () => setSheet('goal'),
      openObjective: () => setSheet('objective'),
      openPause: () => setSheet('pause'),
      wallet
    }),
    [wallet]
  )

  const tabLabel = (key) => t(`common.nav.${key}`)

  return (
    <div className={[styles.shell, focus && styles.shellFocus].filter(Boolean).join(' ')}>
      <a className="skip-link" href="#conteudo">
        {t('common.nav.skip')}
      </a>
      {!focus && (
        <nav className={styles.rail} aria-label={t('common.nav.main')}>
          <Wordmark size={26} to="/app" className={styles.railBrand} />
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className={styles.railGroup}>
              <span className={styles.railGroupLabel}>{t(`common.nav.groups.${group.key}`)}</span>
              {group.items.map((item) => (
                <NavLink key={item.key} to={item.to} end={item.end} className={styles.railTab}>
                  <Icon name={item.icon} size={20} />
                  <span className={styles.railLabel}>{tabLabel(item.key)}</span>
                  {item.badge ? <span className={styles.railBadge}>{item.badge}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
          <span className={styles.railSpacer} />
          <UserMenu />
        </nav>
      )}
      <div className={styles.body}>
        <header className={[styles.topline, chromeHidden && styles.toplineHidden, focus && styles.toplineFloating].filter(Boolean).join(' ')} aria-hidden={chromeHidden || undefined}>
          <div className={[styles.toplineInner, styles.toplineWide].join(' ')}>
            <button type="button" className={[styles.metric, styles.metricStreak].join(' ')} onClick={() => setSheet('goal')} aria-label={`${t('common.topline.streak', { count: streak })}. ${t('common.topline.goalMenu')}`}>
              <Icon name="flame" size={18} />
              <span className="tabnum">{streak}</span>
            </button>
            <button type="button" className={[styles.metric, styles.metricObjective].join(' ')} onClick={() => setSheet(objective ? 'goal' : 'objective')}>
              <Icon name="calendar" size={18} />
              <span className={styles.metricLabel}>
                <ObjectiveLabel objective={objective} t={t} />
              </span>
              <span className="sr-only">. {objective ? t('common.topline.goalMenu') : t('study.goal.addObjective')}</span>
            </button>
            <button type="button" className={[styles.metric, styles.metricNeuron].join(' ')} data-redeemable={wallet?.redeemable ? 'true' : 'false'} onClick={() => navigate('/app/carteira')} aria-label={`${t('common.topline.neurons', { count: balance })}${wallet?.redeemable ? `. ${t('common.topline.neuronsRedeemable')}` : ''}`}>
              <NeuronCounter value={balance} size={18} />
            </button>
            <button type="button" className={[styles.metric, styles.metricIcon].join(' ')} onClick={() => navigate('/app/comunidade/busca?focus=1')} aria-label={t('common.topline.search')}>
              <Icon name="search" size={20} />
            </button>
            {focus && (
              <button type="button" className={[styles.metric, styles.metricIcon].join(' ')} onClick={() => window.dispatchEvent(new CustomEvent('memora:exit-session'))} aria-label={t('common.topline.exitFocus')}>
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
        </header>
        {focus && chromeHidden && <button type="button" className={styles.edge} onClick={study.revealChrome} aria-label={t('common.topline.reveal')} />}
        {peek && (
          <div className={styles.peek} role="status">
            <NeuronCounter value={balance} size={16} />
            <span>{t('study.session.peekRedeemable')}</span>
          </div>
        )}
        {proto.notification && !focus && <NotificationCard />}
        <main id="conteudo" className={[styles.main, focus && styles.mainFocus, wide ? styles.mainWide : styles.mainReadable, fill && styles.mainFill].filter(Boolean).join(' ')} tabIndex={-1}>
          {!focus && (
            <div className={styles.banners}>
              <LayoutBanners />
              <McpArrivalWatcher />
            </div>
          )}
          <Outlet context={outletContext} />
        </main>
      </div>
      {!focus && (
        <NavLink to="/app/criar" className={[styles.fab, focus && styles.fabHidden].filter(Boolean).join(' ')} aria-label={t('common.nav.create')}>
          <Icon name="plus" size={28} />
        </NavLink>
      )}
      <nav className={[styles.tabbar, focus && styles.tabbarHidden].filter(Boolean).join(' ')} aria-label={t('common.nav.main')} aria-hidden={focus || undefined}>
        {TABS.map((tab) => (
          <NavLink key={tab.key} to={tab.to} end={tab.end} className={styles.tab} tabIndex={focus ? -1 : undefined}>
            <span className={styles.tabIcon}>
              <Icon name={tab.icon} size={22} />
            </span>
            {tabLabel(tab.key)}
          </NavLink>
        ))}
      </nav>
      <GoalMenuSheet open={sheet === 'goal'} onClose={() => setSheet(null)} onPause={() => setSheet('pause')} onAddObjective={() => setSheet('objective')} />
      <ObjectiveSheet open={sheet === 'objective'} onClose={() => setSheet(null)} />
      <PauseSheet open={sheet === 'pause'} onClose={() => setSheet(null)} />
    </div>
  )
}
