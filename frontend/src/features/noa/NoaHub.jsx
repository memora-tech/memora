import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import styles from './noa.module.css'
import { Badge, Banner, Button, EmptyState, Icon, Screen, ScreenHeader, Skeleton, TabBar, TabPanel, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useSession } from '../../state/SessionContext.jsx'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'

function Insight({ icon, tone, label, value, text, action }) {
  return (
    <li className={styles.insight} data-tone={tone}>
      <span className={styles.insightIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.insightBody}>
        <span className={styles.insightLabel}>{label}</span>
        <span className={styles.insightValue}>{value}</span>
        <span className={styles.insightText}>{text}</span>
      </span>
      {action}
    </li>
  )
}

function ActionCard({ icon, title, text, to, onClick }) {
  const body = (
    <>
      <span className={styles.actionIcon} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <span className={styles.actionTitle}>{title}</span>
      <span className={styles.actionText}>{text}</span>
      <span className={styles.actionGo} aria-hidden="true">
        <Icon name="arrowRight" size={18} />
      </span>
    </>
  )
  return to ? (
    <Link to={to} className={styles.action}>
      {body}
    </Link>
  ) : (
    <button type="button" className={styles.action} onClick={onClick}>
      {body}
    </button>
  )
}

export function NoaHub() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const outlet = useOutletContext() || {}
  useDocumentTitle(t('noa.title'))
  const overview = useAsync(() => studentApi.get('/noa/overview'), [])
  const [busy, setBusy] = useState(null)
  const [tab, setTab] = useState('suggestions')
  const data = overview.data
  const refresh = () => overview.run().catch(() => {})
  const name = session.user?.name?.split(' ')[0] || ''

  const respond = async (suggestion, accepted) => {
    setBusy(suggestion.id)
    try {
      await studentApi.post(`/noa/suggestions/${suggestion.id}/respond`, { accepted })
      toast.show({ message: accepted ? t('noa.suggestions.accepted') : t('noa.suggestions.dismissed'), icon: accepted ? 'check' : 'x' })
      refresh()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const revert = async (decision) => {
    setBusy(decision.id)
    try {
      await studentApi.post(`/noa/decisions/${decision.id}/revert`)
      toast.show({ message: t('noa.decisions.reverted'), icon: 'refresh' })
      refresh()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const ins = data?.insights
  const budget = data?.budget
  const activeDecisions = data?.decisions.filter((d) => !d.reverted).length || 0

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('noa.eyebrow')}
        title={
          <span className={styles.titleRow}>
            <span className={styles.orb} aria-hidden="true">
              <Icon name="sparkle" size={22} />
            </span>
            {t('noa.title')}
          </span>
        }
        lead={t('noa.lead')}
        actions={budget ? <Badge tone="brand">{t('noa.budget', { used: budget.suggestionsUsed, limit: budget.suggestionsLimit })}</Badge> : null}
      />

      {overview.loading && !data ? <Skeleton height={140} count={3} /> : null}
      {overview.error && !data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={refresh}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}

      {data ? (
        <>
          <section className={styles.briefing} aria-labelledby="noa-briefing">
            <div className={styles.briefingHead}>
              <span className={styles.orbLarge} aria-hidden="true">
                <Icon name="sparkle" size={30} />
              </span>
              <div>
                <h2 id="noa-briefing" className={styles.briefingTitle}>
                  {t('noa.briefing.title', { name })}
                </h2>
                <p className={styles.briefingLead}>{t('noa.briefing.lead')}</p>
              </div>
            </div>
            <ul className={styles.insights}>
              <Insight
                icon="book"
                tone="brand"
                label={t('noa.briefing.todayLabel')}
                value={ins.today.cardsDue ? t('noa.briefing.todayValue', { count: ins.today.cardsDue }) : t('noa.briefing.todayNone')}
                text={ins.today.cardsDue ? t('noa.briefing.todayText', { minutes: ins.today.minutes, decks: ins.today.decks }) : t('noa.briefing.todayNoneText')}
                action={ins.today.cardsDue ? <Button size="small" icon="play" to="/app">{t('noa.briefing.todayAction')}</Button> : null}
              />
              <Insight
                icon="zap"
                tone="warning"
                label={t('noa.briefing.weakLabel')}
                value={ins.weakest ? ins.weakest.name : t('noa.briefing.weakNone')}
                text={ins.weakest ? t('noa.briefing.weakText', { lapses: ins.weakest.lapses, cards: ins.weakest.weakCards }) : t('noa.briefing.weakNoneText')}
                action={ins.weakest ? <Button size="small" variant="soft" to={`/app/decks/${ins.weakest.id}?modo=fracos`}>{t('noa.briefing.weakAction')}</Button> : null}
              />
              <Insight
                icon="target"
                tone="reward"
                label={t('noa.briefing.objectiveLabel')}
                value={ins.objective ? t('noa.briefing.objectiveValue', { count: ins.objective.daysLeft, name: ins.objective.name }) : t('noa.briefing.objectiveNone')}
                text={ins.objective ? t('noa.briefing.objectiveText') : t('noa.briefing.objectiveNoneText')}
                action={<Button size="small" variant="ghost" to="/app/perfil/objetivos">{ins.objective ? t('noa.briefing.objectiveAction') : t('noa.briefing.objectiveAdd')}</Button>}
              />
              <Insight
                icon="chart"
                tone="success"
                label={t('noa.briefing.accuracyLabel')}
                value={ins.accuracy ? `${ins.accuracy.pct}%` : '—'}
                text={ins.accuracy ? t('noa.briefing.accuracyText', { count: ins.accuracy.sample }) : t('noa.briefing.accuracyNone')}
              />
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="noa-acoes">
            <h2 id="noa-acoes" className={styles.sectionTitle}>
              {t('noa.actions.title')}
            </h2>
            <div className={styles.actions}>
              <ActionCard icon="zap" title={t('noa.actions.weak.title')} text={t('noa.actions.weak.text')} to={ins.weakest ? `/app/decks/${ins.weakest.id}?modo=fracos` : '/app/decks'} />
              <ActionCard icon="sparkle" title={t('noa.actions.generate.title')} text={t('noa.actions.generate.text')} to="/app/criar" />
              <ActionCard icon="target" title={t('noa.actions.plan.title')} text={t('noa.actions.plan.text')} to="/app/perfil/objetivos" />
              <ActionCard icon="calendar" title={t('noa.actions.goal.title')} text={t('noa.actions.goal.text', { done: ins.goal.done, goal: ins.goal.goal })} onClick={() => (outlet.openGoalMenu ? outlet.openGoalMenu() : navigate('/app'))} />
            </div>
          </section>

          <TabBar
            idBase="noa"
            label={t('noa.tabsLabel')}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'suggestions', label: t('noa.tabs.suggestions'), icon: 'message', count: data.suggestions.length },
              { value: 'history', label: t('noa.tabs.history'), icon: 'clock', count: activeDecisions },
              { value: 'catalog', label: t('noa.tabs.catalog'), icon: 'list', count: data.catalog.length },
              { value: 'limits', label: t('noa.tabs.limits'), icon: 'shield' }
            ]}
          />

          <TabPanel idBase="noa" value={tab}>
            {tab === 'suggestions' ? (
              data.suggestions.length ? (
                <ul className={styles.list}>
                  {data.suggestions.map((s) => (
                    <li key={s.id} className={styles.suggestion}>
                      <span className={styles.suggestionIcon} aria-hidden="true">
                        <Icon name="sparkle" size={20} />
                      </span>
                      <span className={styles.suggestionBody}>
                        <span className={styles.itemTitle}>{s.title}</span>
                        <span className={styles.itemText}>{s.body}</span>
                        <span className={styles.itemActions}>
                          <Button size="small" icon="check" onClick={() => respond(s, true)} loading={busy === s.id}>
                            {t('noa.suggestions.accept')}
                          </Button>
                          <Button size="small" variant="ghost" onClick={() => respond(s, false)} disabled={busy === s.id}>
                            {t('noa.suggestions.dismiss')}
                          </Button>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon="check" title={t('noa.suggestions.emptyTitle')} text={t('noa.suggestions.emptyText')} />
              )
            ) : null}

            {tab === 'history' ? (
              <>
                <p className={styles.itemText}>{t('noa.decisions.lead')}</p>
                <ol className={styles.timeline}>
                  {data.decisions.map((d) => (
                    <li key={d.id} className={styles.timelineItem} data-reverted={d.reverted ? 'true' : 'false'}>
                      <span className={styles.timelineDot} aria-hidden="true" />
                      <span className={styles.timelineBody}>
                        <span className={styles.itemText}>{d.text}</span>
                        <span className={styles.itemMeta}>
                          {fmtRelative(d.at)}
                          {d.reverted ? ` · ${t('noa.decisions.revertedTag')}` : ''}
                        </span>
                      </span>
                      {d.reversible && !d.reverted ? (
                        <Button size="small" variant="ghost" icon="refresh" onClick={() => revert(d)} loading={busy === d.id}>
                          {t('noa.decisions.revert')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}

            {tab === 'catalog' ? (
              <ul className={styles.catalog}>
                {data.catalog.map((a) => (
                  <li key={a.key} className={styles.catalogItem}>
                    <span className={styles.catalogHead}>
                      <span className={styles.itemTitle}>{a.name}</span>
                      <Badge tone={a.autonomous ? 'brand' : 'neutral'}>{a.autonomous ? t('noa.catalog.autonomous') : t('noa.catalog.asks')}</Badge>
                    </span>
                    <span className={styles.itemText}>{a.effect}</span>
                    <span className={styles.itemMeta}>
                      <strong>{t('noa.catalog.trigger')}:</strong> {a.trigger}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === 'limits' ? (
              <div className={styles.limits}>
                <div className={styles.limitBox}>
                  <span className={styles.itemTitle}>
                    <Icon name="eye" size={18} /> {t('noa.limits.signals')}
                  </span>
                  <ul className={styles.bullets}>
                    {data.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.limitBox} data-tone="danger">
                  <span className={styles.itemTitle}>
                    <Icon name="shield" size={18} /> {t('noa.limits.never')}
                  </span>
                  <ul className={styles.bullets}>
                    {data.neverAlone.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <p className={styles.itemMeta}>{t('noa.limits.budget', { suggestions: budget?.suggestionsLimit ?? 0, autonomous: budget?.autonomousLimit ?? 0, version: data.catalogVersion })}</p>
              </div>
            ) : null}
          </TabPanel>
        </>
      ) : null}
    </Screen>
  )
}
