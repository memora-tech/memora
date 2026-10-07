import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './profile.module.css'
import { Avatar, Badge, Banner, Button, Chip, ConfirmDialog, ListItem, Panel, Screen, ScreenHeader, Skeleton, StatRow, StatTile, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { NoaCard } from '../study/NoaCard.jsx'
import { MyBlogPanel } from './MyBlogPanel.jsx'

const SHORTCUTS = [
  { key: 'requests', icon: 'archive', to: '/app/recebidos' },
  { key: 'connections', icon: 'plug', to: '/app/perfil/conexoes' },
  { key: 'wallet', icon: 'wallet', to: '/app/carteira' },
  { key: 'objectives', icon: 'target', to: '/app/perfil/objetivos' },
  { key: 'subscription', icon: 'zap', to: '/app/perfil/assinatura' },
  { key: 'devices', icon: 'device', to: '/app/perfil/dispositivos' },
  { key: 'privacy', icon: 'shield', to: '/app/perfil/privacidade' },
  { key: 'settings', icon: 'settings', to: '/app/perfil/configuracoes' },
  { key: 'support', icon: 'help', to: '/app/perfil/suporte' }
]

export function ProfileHome() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [reinforcementDone, setReinforcementDone] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const wallet = useAsync(() => studentApi.get('/wallet'), [session.user?.balance])
  const mistakes = useAsync(() => studentApi.get('/study/mistakes'), [])
  const history = useAsync(() => studentApi.get('/study/history'), [])
  useDocumentTitle(t('profile.title'))
  const user = session.user
  if (!user) return <Skeleton height={160} />
  const pub = user.publicProfile || {}
  const badges = pub.badges || []
  const neuronsTotal = wallet.data ? wallet.data.ledger.filter((e) => e.amount > 0).reduce((n, e) => n + e.amount, 0) : null

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('profile.eyebrow')}
        title={t('profile.title')}
        lead={t('profile.lead')}
        actions={
          <Chip tone={user.plan === 'premium' ? 'reward' : 'neutral'} icon={user.plan === 'premium' ? 'zap' : undefined}>
            {t(`common.nav.plan.${user.plan}`)}
          </Chip>
        }
      />

      <StatRow>
        <StatTile icon="flame" tone="reward" label={t('profile.labels.streak')} value={user.streak ?? 0} />
        <StatTile icon="calendar" label={t('profile.labels.studyDays')} value={user.studyDays ?? 0} />
        <StatTile icon="layers" label={t('profile.labels.cards')} value={pub.cardsGenerated ?? 0} />
        <StatTile icon="neuron" tone="ink" label={t('wallet.balance')} value={fmtNumber(user.balance ?? 0)} note={neuronsTotal !== null ? `${fmtNumber(neuronsTotal)} ${t('profile.labels.neurons')}` : null} />
      </StatRow>

      <div className={styles.profileLayout}>
        <div className={styles.profileMain}>
          <Surface className={styles.publicCard} aria-labelledby="perfil-publico">
            <span id="perfil-publico" className={styles.meta}>
              {t('profile.publicHeader')}
            </span>
            <div className={styles.identity}>
              <Avatar name={user.name} large />
              <div className={styles.identityBody}>
                <h2 className={styles.name}>{user.name}</h2>
                <span className={styles.meta}>{t('profile.level', { level: pub.level ?? 1, topic: pub.topic || '—' })}</span>
                <span className={styles.meta}>{t('profile.points', { count: pub.points ?? 0 })}</span>
              </div>
            </div>
            <div className={styles.chips}>
              {badges.length ? badges.slice(0, 3).map((b) => (
                <Chip key={b} tone="reward" icon="trophy">
                  {b}
                </Chip>
              )) : (
                <span className={styles.meta}>{t('profile.noBadges')}</span>
              )}
              {badges.length > 3 ? <Badge>+{badges.length - 3}</Badge> : null}
            </div>
          </Surface>

          <MyBlogPanel />

          {user.isMinor ? (
            <Surface tone="brand">
              <span className={styles.meta}>{t('profile.minor')}</span>
            </Surface>
          ) : null}


          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('profile.history.title')}</h2>
            {history.error && !history.data ? (
              <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => history.run()}>{t('common.actions.retry')}</Button>}>
                {t('common.state.error')}
              </Banner>
            ) : (
              <Surface>
                {history.data?.items?.length ? (
                  <>
                    {(historyOpen ? history.data.items : history.data.items.slice(0, 4)).map((h) => (
                      <div key={h.deckId} className={styles.mistake}>
                        <span className={styles.mistakeText}>
                          <span className={styles.rowTitle}>{h.name}</span>
                          <span className={styles.meta}>
                            {h.kind === 'community' ? `${t('profile.history.community')}${h.authorName ? ` · ${h.authorName}` : ''}` : t('profile.history.own')} · {t('profile.history.last', { when: fmtRelative(h.lastAt) })}
                          </span>
                        </span>
                        {h.reviews ? <Chip tone="neutral">{t('profile.history.reviews', { count: h.reviews })}</Chip> : null}
                      </div>
                    ))}
                    {history.data.items.length > 4 ? (
                      <Button variant="text" size="small" icon={historyOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setHistoryOpen((v) => !v)}>
                        {historyOpen ? t('profile.history.less') : t('profile.history.more', { count: history.data.items.length - 4 })}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className={styles.meta}>{t('profile.history.empty')}</p>
                )}
              </Surface>
            )}
          </section>

          {mistakes.data?.items?.length ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('profile.mistakes')}</h2>
              <Surface>
                {mistakes.data.items.slice(0, 5).map((m) => (
                  <div key={m.cardId} className={styles.mistake}>
                    <span className={styles.mistakeText}>
                      <span className={styles.rowTitle}>{m.front}</span>
                      <span className={styles.meta}>{m.deckName}</span>
                    </span>
                    <Chip tone="warning">{t('profile.lapses', { count: m.lapses })}</Chip>
                  </div>
                ))}
              </Surface>
              {mistakes.data.reinforcement && !reinforcementDone ? (
                <NoaCard
                  title={t('profile.reinforcementTitle')}
                  body={mistakes.data.reinforcement.suggestion}
                  onAccept={() => {
                    setReinforcementDone(true)
                    toast.show({ message: t('profile.reinforcementAccepted'), icon: 'check' })
                    navigate('/app/criar')
                  }}
                  onDismiss={() => setReinforcementDone(true)}
                  compact
                />
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className={styles.profileAside} aria-label={t('profile.accountLabel')}>
          <Panel title={t('profile.accountLabel')} icon="settings" labelledBy="perfil-conta">
            <nav className={styles.shortcuts} aria-label={t('profile.accountLabel')}>
              {SHORTCUTS.map((s) => (
                <ListItem key={s.key} icon={s.icon} title={t(`profile.shortcuts.${s.key}`)} to={s.to} />
              ))}
            </nav>
            <Button variant="ghost" icon="logout" onClick={() => setLogoutOpen(true)}>
              {t('profile.logout')}
            </Button>
          </Panel>
        </aside>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={t('profile.logoutTitle')}
        confirmLabel={t('profile.logout')}
        onConfirm={async () => {
          await session.logout()
          navigate('/entrar', { replace: true })
        }}
      >
        <p>{t('profile.logoutText')}</p>
      </ConfirmDialog>
    </Screen>
  )
}
