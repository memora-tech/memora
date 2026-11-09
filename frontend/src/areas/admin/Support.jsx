import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Input, Textarea, Toggle, TabBar, TabPanel, Surface, Sheet, SectionTitle, ScreenHeader, StatTile, useToast, Stat } from '../../design-system/index.js'
import { useSectionEyebrow } from './AdminLayout.jsx'
import { PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard, getAdminUser } from './adminSession.js'

const TICKET_TONE = { aberto: 'warning', respondido: 'brand', resolvido: 'success' }

export function Support() {
  const t = useT()
  const [tab, setTab] = useState('accounts')
  const eyebrow = useSectionEyebrow('suporte')
  useDocumentTitle(t('admin.support.title'))
  return (
    <>
      <ScreenHeader size="compact" eyebrow={eyebrow} title={t('admin.support.title')} lead={t('admin.pages.support.lead')} />
      <div className={panelStyles.stickyBar}>
        <TabBar
          label={t('admin.support.title')}
          idBase="suporte"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'accounts', label: t('admin.support.tabs.accounts'), icon: 'user' },
            { value: 'tickets', label: t('admin.support.tabs.tickets'), icon: 'message' }
          ]}
        />
      </div>
      <TabPanel idBase="suporte" value={tab}>
        {tab === 'accounts' ? <Accounts /> : <Tickets />}
      </TabPanel>
    </>
  )
}

function Accounts() {
  const t = useT()
  const guard = useAdminGuard()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [target, setTarget] = useState(null)
  const [purpose, setPurpose] = useState('')
  const [consentRef, setConsentRef] = useState('')
  const [formError, setFormError] = useState(null)
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)

  const search = async (e) => {
    e?.preventDefault()
    setSearching(true)
    setError(null)
    try {
      const res = await adminApi.get(`/admin/support/search?q=${encodeURIComponent(q)}`)
      setResults(res.users)
    } catch (err) {
      if (!guard(err)) setError(err)
    } finally {
      setSearching(false)
    }
  }

  const openView = async () => {
    if (!purpose.trim() || !consentRef.trim()) {
      setFormError(t('admin.support.validation'))
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      const res = await adminApi.post(`/admin/support/users/${target.id}/view-as`, { purpose: purpose.trim(), consentReference: consentRef.trim() })
      setView(res)
      setTarget(null)
    } catch (err) {
      if (!guard(err)) setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.stack}>
      <form onSubmit={search} className={styles.searchBar} role="search">
        <div>
          <Input label={t('admin.support.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button type="submit" icon="search" loading={searching}>
          {t('admin.support.searchButton')}
        </Button>
      </form>
      <AdminState error={error} onRetry={search} />
      {results ? (
        results.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{t('admin.support.results')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.support.account')}</th>
                  <th scope="col">{t('admin.support.email')}</th>
                  <th scope="col">{t('admin.support.plan')}</th>
                  <th scope="col">{t('admin.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">
                      <span className={styles.cellTitle}>{u.name}</span> {u.isMinor ? <Badge tone="brand">{t('admin.support.minor')}</Badge> : null}
                    </th>
                    <td className={styles.mono}>{u.email}</td>
                    <td>
                      <Badge tone={u.plan === 'premium' ? 'reward' : 'neutral'}>{t(`admin.plan.${u.plan}`)}</Badge>
                    </td>
                    <td>
                      <Button
                        variant="soft"
                        size="small"
                        icon="eye"
                        onClick={() => {
                          setTarget(u)
                          setPurpose('')
                          setConsentRef('')
                          setFormError(null)
                        }}
                      >
                        {t('admin.support.viewAs')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PanelEmpty icon="user" title={t('admin.support.noResults')} />
        )
      ) : null}
      {results === null && !view ? <PanelEmpty icon="search" title={t('admin.pages.support.searchTitle')} text={t('admin.pages.support.searchHint')} /> : null}
      {view ? <ViewAs view={view} onClose={() => setView(null)} /> : null}
      <Sheet
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target ? t('admin.support.viewAsTitle', { name: target.name }) : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button icon="eye" onClick={openView} loading={busy}>
              {t('admin.support.open')}
            </Button>
          </>
        }
      >
        <Banner tone="warning" icon="lock">
          {t('admin.support.viewAsIntro')}
        </Banner>
        <Input label={t('admin.support.purpose')} hint={t('admin.support.purposeHint')} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <Input label={t('admin.support.consentRef')} hint={t('admin.support.consentHint')} value={consentRef} onChange={(e) => setConsentRef(e.target.value)} />
        {formError ? (
          <Banner tone="danger" icon="alert">
            {formError}
          </Banner>
        ) : null}
      </Sheet>
    </div>
  )
}

function ViewAs({ view, onClose }) {
  const t = useT()
  const quiet = view.quietWindowInferred
  const quietKind = quiet?.lockedForMinor ? t('admin.support.quietMinor') : quiet?.learned ? t('admin.support.quietLearned') : t('admin.support.quietDefault')
  return (
    <Surface tone="sunken" className={styles.stack} aria-label={t('admin.support.readOnly')}>
      <div className={styles.cardHead}>
        <div className={styles.chips}>
          <Badge tone="warning" icon="eye">
            {t('admin.support.readOnly')}
          </Badge>
          <span className={styles.cellMeta}>{t('admin.support.recorded', { date: fmtDateTime(view.consent.recordedAt) })}</span>
        </div>
        <Button variant="text" icon="x" size="small" onClick={onClose}>
          {t('admin.common.close')}
        </Button>
      </div>
      <div className={styles.grid2}>
        <Surface className={styles.stack}>
          <SectionTitle as="h3">{t('admin.support.account')}</SectionTitle>
          <dl className={styles.definition}>
            <dt>{t('admin.support.account')}</dt>
            <dd>{view.account.name}</dd>
            <dt>{t('admin.support.email')}</dt>
            <dd className={styles.mono}>{view.account.email}</dd>
            <dt>{t('admin.support.phone')}</dt>
            <dd className={styles.mono}>{view.account.phone}</dd>
            <dt>{t('admin.support.plan')}</dt>
            <dd>{t(`admin.plan.${view.account.plan}`)}</dd>
            <dt>{t('admin.support.verified')}</dt>
            <dd>{[view.account.verified?.email && t('admin.support.verifiedEmail'), view.account.verified?.phone && t('admin.support.verifiedPhone')].filter(Boolean).join(', ') || t('admin.common.none')}</dd>
            <dt>{t('admin.support.ageVerification')}</dt>
            <dd>
              {view.account.ageVerification.status} · {view.account.ageVerification.method}
            </dd>
            <dt>{t('admin.support.documents')}</dt>
            <dd>{view.account.ageVerification.documents}</dd>
            <dt>{t('admin.support.createdAt')}</dt>
            <dd>{fmtDate(view.account.createdAt)}</dd>
          </dl>
        </Surface>
        <Surface className={styles.stack}>
          <SectionTitle as="h3">{t('admin.support.study')}</SectionTitle>
          <div className={styles.statsRow}>
            <Stat value={view.study.streak} label={t('admin.support.streak')} />
            <Stat value={view.study.goal} label={t('admin.support.goal')} />
            <Stat value={view.study.doneToday} label={t('admin.support.doneToday')} />
            <Stat value={`${view.study.reschedules.used}/${view.study.reschedules.limit}`} label={t('admin.support.reschedules')} />
          </div>
          <dl className={styles.definition}>
            <dt>{t('admin.support.studyDays')}</dt>
            <dd>{view.study.studyDays}</dd>
            <dt>{t('admin.support.paused')}</dt>
            <dd>{view.study.pausedUntil ? fmtDate(view.study.pausedUntil) : t('admin.common.none')}</dd>
          </dl>
        </Surface>
        <Surface className={styles.stack}>
          <SectionTitle as="h3">{t('admin.support.wallet')}</SectionTitle>
          <div className={styles.statsRow}>
            <Stat value={fmtNumber(view.wallet.balance)} label={t('admin.support.balance')} />
            <Stat value={view.wallet.coupons} label={t('admin.support.coupons')} />
          </div>
          <SectionTitle as="h3">{t('admin.support.subscription')}</SectionTitle>
          {view.subscription ? (
            <dl className={styles.definition}>
              <dt>{t('admin.support.plan')}</dt>
              <dd>
                {t(`admin.plan.${view.subscription.plan}`)}
                {view.subscription.cycle ? ` · ${view.subscription.cycle}` : ''}
                {view.subscription.method ? ` · ${view.subscription.method}` : ''}
              </dd>
              {view.subscription.lastPayment ? (
                <>
                  <dt>{t('admin.support.lastPayment')}</dt>
                  <dd>
                    {fmtDate(view.subscription.lastPayment.at)} · {view.subscription.lastPayment.status}
                  </dd>
                  <dt>{t('admin.support.card')}</dt>
                  <dd>{view.subscription.lastPayment.card}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className={styles.cellMeta}>{t('admin.common.none')}</p>
          )}
        </Surface>
        <Surface className={styles.stack}>
          <SectionTitle as="h3">{t('admin.support.notifications')}</SectionTitle>
          <dl className={styles.definition}>
            <dt>{t('admin.support.intensity')}</dt>
            <dd>{view.notifications.intensity}</dd>
            <dt>{t('admin.support.reminder')}</dt>
            <dd>{view.notifications.reminderTime}</dd>
            <dt>{t('admin.support.quietWindow')}</dt>
            <dd>
              {t('admin.support.quietWindowValue', { start: quiet.start, end: quiet.end })} · {quietKind}
            </dd>
          </dl>
          <SectionTitle as="h3">{t('admin.support.tickets')}</SectionTitle>
          {view.tickets.length ? (
            <ul className={styles.stack}>
              {view.tickets.map((tk) => (
                <li key={tk.id} className={styles.cardHead}>
                  <span>{tk.subject}</span>
                  <Badge tone={TICKET_TONE[tk.status] || 'neutral'}>{t(`admin.support.ticketStatus.${tk.status}`)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.cellMeta}>{t('admin.support.emptyTickets')}</p>
          )}
        </Surface>
      </div>
    </Surface>
  )
}

function Tickets() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  const me = getAdminUser()
  const canReply = ['suporte_n1', 'suporte_n2', 'engenharia'].includes(me?.role)
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(null)
  const state = useAdminData(() => adminApi.get('/admin/support/tickets'))
  const tickets = state.data?.tickets || []
  const count = (status) => tickets.filter((x) => x.status === status).length

  const draft = (id) => drafts[id] || { text: '', close: false }
  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...patch } }))

  const reply = async (ticket) => {
    const d = draft(ticket.id)
    if (!d.text.trim()) return
    setBusy(ticket.id)
    try {
      const res = await adminApi.post(`/admin/support/tickets/${ticket.id}/reply`, { text: d.text.trim(), close: d.close })
      state.setData({ ...state.data, tickets: tickets.map((x) => (x.id === ticket.id ? res.ticket : x)) })
      setDraft(ticket.id, { text: '' })
      toast.show({ message: t('admin.support.replied'), icon: 'send' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.stack}>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {state.data ? (
        <>
          <div className={panelStyles.kpis}>
            <StatTile
              size="compact"
              icon="message"
              label={t('admin.pages.support.kpiOpen')}
              value={count('aberto')}
              note={
                <Trend tone={count('aberto') ? 'warning' : 'success'} icon="clock">
                  {t('admin.support.sla', { hours: state.data.sla.humanResponseHours, minorHours: state.data.sla.minorSuspicionHours }).split(';')[0]}
                </Trend>
              }
            />
            <StatTile size="compact" icon="send" label={t('admin.pages.support.kpiAnswered')} value={count('respondido')} />
            <StatTile size="compact" icon="check" label={t('admin.pages.support.kpiResolved')} value={count('resolvido')} />
          </div>
          <p className={panelStyles.callout}>{t('admin.support.sla', { hours: state.data.sla.humanResponseHours, minorHours: state.data.sla.minorSuspicionHours })}</p>
          {!canReply ? (
            <Banner tone="neutral" icon="lock">
              {t('admin.support.replyForbidden')}
            </Banner>
          ) : null}
          {tickets.length ? (
            <div className={styles.list}>
              {tickets.map((tk) => {
                const d = draft(tk.id)
                return (
                  <article key={tk.id} className={styles.card} data-tone={tk.status === 'aberto' ? 'warning' : tk.status === 'resolvido' ? 'muted' : undefined}>
                    <div className={styles.cardHead}>
                      <div className={styles.stack}>
                        <h2 className={styles.cardTitle}>{tk.subject}</h2>
                        <span className={styles.cellMeta}>
                          {tk.userId} · {t('admin.support.createdTicket', { when: fmtRelative(tk.createdAt) })}
                        </span>
                      </div>
                      <Badge tone={TICKET_TONE[tk.status] || 'neutral'}>{t(`admin.support.ticketStatus.${tk.status}`)}</Badge>
                    </div>
                    <p className={styles.quote}>{tk.message}</p>
                    {tk.replies.length ? (
                      <ul className={styles.thread}>
                        {tk.replies.map((r, i) => (
                          <li key={i} className={`${styles.replyItem} ${r.mine ? '' : styles.replyMine}`}>
                            <span className={styles.cellMeta}>
                              {t('admin.support.by', { name: r.by })} · {fmtRelative(r.at)}
                            </span>
                            <p>{r.text}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canReply ? (
                      <div className={styles.form}>
                        <div className={styles.formFull}>
                          <Textarea label={t('admin.support.reply')} placeholder={t('admin.support.replyPlaceholder')} value={d.text} onChange={(e) => setDraft(tk.id, { text: e.target.value })} />
                        </div>
                        <Toggle label={t('admin.support.closeTicket')} checked={d.close} onChange={(v) => setDraft(tk.id, { close: v })} />
                        <div className={styles.formActions}>
                          <Button icon="send" onClick={() => reply(tk)} loading={busy === tk.id} disabled={!d.text.trim()}>
                            {t('admin.support.send')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <PanelEmpty icon="message" title={t('admin.support.emptyTickets')} />
          )}
        </>
      ) : null}
    </div>
  )
}
