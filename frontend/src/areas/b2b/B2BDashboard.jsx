import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './b2b.module.css'
import { Button, Badge, Chip, Banner, Panel, ScreenHeader, StatTile, TabBar, TabPanel, Input, Select, Icon, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { b2bApi } from '../../lib/api.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative, fmtNumber } from '../../lib/format.js'
import { B2BShell, B2BState, B2B_TABS, TenantFacts, tabFromSearch } from './B2BShell.jsx'
import { Meter, PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
import { useB2BGuard } from './b2bSession.js'

const METHODS = [
  { value: 'e-mail', key: 'email' },
  { value: 'telefone', key: 'phone' },
  { value: 'código de turma', key: 'code' }
]

export function B2BDashboard() {
  const t = useT()
  const guard = useB2BGuard()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const tab = tabFromSearch(location.search)
  const setTab = (value) => {
    const slug = B2B_TABS.find((x) => x.value === value)?.slug
    navigate(value === 'classes' ? '/b2b/painel' : `/b2b/painel?aba=${slug}`, { replace: true })
  }
  const [exportResult, setExportResult] = useState(null)
  useDocumentTitle(t('b2b.name'))

  const overview = useAsync(async () => {
    try {
      return await b2bApi.get('/b2b/overview')
    } catch (err) {
      if (!guard(err)) throw err
      return null
    }
  }, [guard])

  const data = overview.data
  const role = data?.me?.role
  const canSeeIndicators = role === 'coordenador' || role === 'admin'
  const canSeeUsers = role === 'admin'
  const canInvite = ['admin', 'coordenador', 'professor'].includes(role)

  const classes = data?.classes || []
  const totalStudents = classes.reduce((sum, k) => sum + (k.total || 0), 0)
  const totalConsented = classes.reduce((sum, k) => sum + (k.consented || 0), 0)
  const consentPct = totalStudents ? Math.round((totalConsented / totalStudents) * 100) : 0
  const withAgg = classes.filter((k) => k.aggregates)
  const aggWeight = withAgg.reduce((sum, k) => sum + k.aggregates.activeStudents, 0)
  const avgAccuracy = aggWeight ? Math.round(withAgg.reduce((sum, k) => sum + k.aggregates.avgAccuracy * k.aggregates.activeStudents, 0) / aggWeight) : null
  const blocked = classes.length - withAgg.length

  const tabs = [
    { value: 'classes', label: t('b2b.nav.classes'), icon: 'school', count: data?.classes?.length },
    { value: 'invites', label: t('b2b.nav.invites'), icon: 'mail', count: data?.invites?.length },
    { value: 'indicators', label: t('b2b.nav.indicators'), icon: 'chart' },
    { value: 'users', label: t('b2b.nav.users'), icon: 'users' }
  ]

  const exportFile = async (format) => {
    try {
      const res = await b2bApi.get(`/b2b/export?format=${format}`)
      setExportResult(res)
      toast.show({ message: t('b2b.export.done', { file: res.fileName, rows: res.rows }), icon: 'download' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <B2BShell overview={data}>
      <B2BState loading={overview.loading} error={overview.error} onRetry={() => overview.run().catch(() => {})} />
      {data ? (
        <>
          <ScreenHeader
            size="compact"
            eyebrow={t('b2b.shell.eyebrow')}
            title={data.tenant.name}
            lead={t('b2b.shell.lead')}
            actions={
              <>
                <Button variant="ghost" size="small" icon="download" onClick={() => exportFile('csv')}>
                  {t('b2b.export.csv')}
                </Button>
                <Button variant="ghost" size="small" icon="download" onClick={() => exportFile('xlsx')}>
                  {t('b2b.export.xlsx')}
                </Button>
              </>
            }
          />
          <TenantFacts tenant={data.tenant} />
          <div className={panelStyles.kpis}>
            <StatTile
              size="compact"
              icon="school"
              label={t('b2b.kpi.classes')}
              value={fmtNumber(classes.length)}
              note={
                blocked ? (
                  <Trend tone="warning" icon="alert">
                    {t('b2b.kpi.blocked', { count: blocked })}
                  </Trend>
                ) : (
                  <Trend tone="success" icon="check">
                    {t('b2b.kpi.noBlocked')}
                  </Trend>
                )
              }
            />
            <StatTile size="compact" icon="users" label={t('b2b.kpi.students')} value={fmtNumber(totalStudents)} />
            <StatTile
              size="compact"
              icon="shield"
              label={t('b2b.kpi.consented')}
              value={fmtNumber(totalConsented)}
              note={
                <>
                  <Meter value={consentPct} tone={consentPct >= 60 ? 'success' : 'warning'} label={t('b2b.kpi.consentedNote', { pct: consentPct })} />
                  <span>{t('b2b.kpi.consentedNote', { pct: consentPct })}</span>
                </>
              }
            />
            <StatTile size="compact" tone="ink" icon="target" label={t('b2b.kpi.accuracy')} value={avgAccuracy === null ? '—' : `${avgAccuracy}%`} note={t('b2b.kpi.accuracyNote')} />
          </div>
          <Panel tone="quiet" title={t('b2b.rules.title')} icon="shield" labelledBy="rules-title">
            <ul className={panelStyles.rules}>
              <li>
                <Icon name="alert" size={16} /> {t('b2b.rules.noRanking')}
              </li>
              <li>
                <Icon name="users" size={16} /> {t('b2b.rules.minAggregate', { min: data.rules.minAggregate })}
              </li>
              <li>
                <Icon name="shield" size={16} /> {t('b2b.rules.consent')}
              </li>
              <li>
                <Icon name="route" size={16} /> {t('b2b.rules.projection')}
              </li>
              <li>
                <Icon name="clock" size={16} /> {t('b2b.rules.api')}
              </li>
            </ul>
          </Panel>
          <div className={panelStyles.stickyBar}>
            <TabBar tabs={tabs} value={tab} onChange={setTab} label={t('b2b.nav.label')} idBase="b2b" />
          </div>
          {exportResult ? (
            <Banner
              tone="success"
              icon="check"
              action={
                <Button variant="text" size="small" href={exportResult.url} download={exportResult.fileName}>
                  {t('b2b.export.download', { file: exportResult.fileName })}
                </Button>
              }
            >
              {t('b2b.export.done', { file: exportResult.fileName, rows: exportResult.rows })} {exportResult.note ? exportResult.note : t('b2b.export.note')}
            </Banner>
          ) : null}
          <TabPanel idBase="b2b" value={tab}>
            {tab === 'classes' ? <ClassesTab classes={data.classes} /> : null}
            {tab === 'invites' ? <InvitesTab data={data} canInvite={canInvite} onCreated={(invite) => overview.setData({ ...data, invites: [invite, ...data.invites] })} guard={guard} /> : null}
            {tab === 'indicators' ? <IndicatorsTab data={data} allowed={canSeeIndicators} /> : null}
            {tab === 'users' ? <UsersTab users={data.users} allowed={canSeeUsers} /> : null}
          </TabPanel>
        </>
      ) : null}
    </B2BShell>
  )
}

function ClassesTab({ classes }) {
  const t = useT()
  const navigate = useNavigate()
  if (!classes?.length) return <PanelEmpty icon="school" title={t('b2b.classes.empty')} />
  return (
    <section aria-label={t('b2b.classes.title')} className={styles.grid}>
      {classes.map((k) => (
        <ClassCard key={k.id} klass={k} onOpen={() => navigate(`/b2b/painel/turmas/${k.id}`)} />
      ))}
    </section>
  )
}

export function ClassCard({ klass: k, onOpen, heading = 'h3' }) {
  const t = useT()
  const Heading = heading
  const ok = k.consented >= k.minAggregate
  const pct = k.total ? Math.round((k.consented / k.total) * 100) : 0
  return (
    <article className={styles.classCard} data-tone={ok ? undefined : 'warning'}>
      <div className={styles.classHead}>
        <span className={styles.classGlyph} aria-hidden="true">
          {(k.subject || k.name).slice(0, 2)}
        </span>
        <div className={styles.classHeadText}>
          <Heading className={styles.classTitle}>{onOpen ? k.name : t('b2b.classes.aggregates')}</Heading>
          <div className={styles.metaList}>
            <span>{k.subject}</span>
            <span>{k.room}</span>
            <span>{t('b2b.classes.period', { year: k.year, semester: k.semester })}</span>
            <span>{k.teacherName}</span>
          </div>
        </div>
        <Chip tone="neutral" icon="users">
          {t('b2b.classes.students', { count: k.total })}
        </Chip>
      </div>
      <div className={styles.consentRow}>
        <Badge tone={ok ? 'success' : 'warning'}>{t('b2b.classes.consented', { count: k.consented })}</Badge>
        <Meter value={pct} tone={ok ? 'success' : 'warning'} label={t('b2b.classes.consented', { count: k.consented })} />
      </div>
      {k.aggregates ? (
        <dl className={styles.stats}>
          <div>
            <dt>{t('b2b.classes.activeStudents')}</dt>
            <dd>{fmtNumber(k.aggregates.activeStudents)}</dd>
          </div>
          <div>
            <dt>{t('b2b.classes.avgAccuracy')}</dt>
            <dd>{`${k.aggregates.avgAccuracy}%`}</dd>
          </div>
          <div>
            <dt>{t('b2b.classes.avgCardsWeek')}</dt>
            <dd>{fmtNumber(k.aggregates.avgCardsWeek)}</dd>
          </div>
          <div>
            <dt>{t('b2b.classes.active7d')}</dt>
            <dd>{fmtNumber(k.aggregates.studiedLast7Days)}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.blocked}>
          <Icon name="lock" size={16} />
          <span>
            <strong>{t('b2b.classes.blocked')}</strong> {k.aggregateBlockedReason}
          </span>
        </p>
      )}
      {onOpen ? (
        <div className={styles.classFoot}>
          <Button variant="soft" size="small" iconRight="chevronRight" onClick={onOpen}>
            {t('b2b.classes.open')}
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function InvitesTab({ data, canInvite, onCreated, guard }) {
  const t = useT()
  const toast = useToast()
  const [contact, setContact] = useState('')
  const [classId, setClassId] = useState(data.classes[0]?.id || '')
  const [method, setMethod] = useState('e-mail')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!contact.trim() || !classId) {
      setError(t('b2b.invites.validation'))
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await b2bApi.post('/b2b/invites', { contact, classId, method })
      onCreated(res.invite)
      setContact('')
      toast.show({ message: t('b2b.invites.sent'), icon: 'send' })
    } catch (err) {
      if (!guard(err)) setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label={t('b2b.invites.title')} className={styles.stack}>
      {canInvite ? (
        <Panel tone="quiet" title={t('b2b.invites.new')} icon="send" labelledBy="invite-new-title">
          <form className={styles.form} onSubmit={submit}>
            <Input label={t('b2b.invites.contact')} hint={t('b2b.invites.contactHint')} value={contact} onChange={(e) => setContact(e.target.value)} error={error} />
            <Select label={t('b2b.invites.class')} value={classId} onChange={(e) => setClassId(e.target.value)}>
              {data.classes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} · {k.subject}
                </option>
              ))}
            </Select>
            <Select label={t('b2b.invites.method')} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(`b2b.invites.methods.${m.key}`)}
                </option>
              ))}
            </Select>
            <div className={styles.formActions}>
              <Button type="submit" icon="send" loading={loading}>
                {t('b2b.invites.send')}
              </Button>
            </div>
          </form>
        </Panel>
      ) : (
        <Banner tone="neutral" icon="info">
          {t('b2b.invites.forbidden')}
        </Banner>
      )}
      {data.invites.length ? (
        <Panel tone="quiet" title={t('b2b.nav.invites')} icon="mail" labelledBy="invite-list-title" bodyClassName={styles.panelFlush}>
          <ul className={styles.inviteList}>
            {data.invites.map((inv) => {
              const klass = data.classes.find((k) => k.id === inv.classId)
              return (
                <li key={inv.id} className={styles.inviteRow}>
                  <span className={styles.inviteAvatar} aria-hidden="true">
                    <Icon name={inv.method === 'telefone' ? 'phone' : inv.method === 'e-mail' ? 'mail' : 'key'} size={16} />
                  </span>
                  <span className={styles.inviteContact}>{inv.contact}</span>
                  <Chip tone="neutral">{klass ? klass.name : inv.classId}</Chip>
                  <Chip tone="neutral">{inv.method}</Chip>
                  <Badge tone={inv.status === 'aceito' ? 'success' : 'warning'}>{t(`b2b.invites.status.${inv.status}`)}</Badge>
                  {inv.minor ? <Badge tone="brand">{t('b2b.invites.minor')}</Badge> : null}
                  {inv.guardianStatus ? <span className={styles.userName}>{t('b2b.invites.guardian', { status: inv.guardianStatus })}</span> : null}
                  <span className={styles.userName}>{t('b2b.invites.sentAt', { when: fmtRelative(inv.sentAt) })}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : (
        <PanelEmpty icon="mail" title={t('b2b.invites.empty')} />
      )}
    </section>
  )
}

function IndicatorsTab({ data, allowed }) {
  const t = useT()
  if (!allowed || !data.indicators) {
    return (
      <Banner tone="neutral" icon="lock">
        {t('b2b.indicators.restricted')}
      </Banner>
    )
  }
  const ind = data.indicators
  return (
    <section aria-label={t('b2b.indicators.title')} className={styles.stack}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{t('b2b.indicators.byClass')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('b2b.indicators.class')}</th>
              <th scope="col">{t('b2b.indicators.room')}</th>
              <th scope="col">{t('b2b.indicators.subject')}</th>
              <th scope="col" className="num">
                {t('b2b.indicators.consentedStudents')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgAccuracy')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgCardsWeek')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map((k) => (
              <tr key={k.id}>
                <th scope="row">{k.name}</th>
                <td>{k.room}</td>
                <td>{k.subject}</td>
                <td className="num">{k.consented}</td>
                <td className="num">{k.aggregates ? `${k.aggregates.avgAccuracy}%` : t('b2b.indicators.suppressed', { min: k.minAggregate })}</td>
                <td className="num">{k.aggregates ? fmtNumber(k.aggregates.avgCardsWeek) : t('b2b.indicators.suppressed', { min: k.minAggregate })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{t('b2b.indicators.byTeacher')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('b2b.indicators.teacher')}</th>
              <th scope="col" className="num">
                {t('b2b.indicators.classes')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.consentedStudents')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgAccuracy')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgCardsWeek')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ind.byTeacher.map((row) => (
              <tr key={row.teacher}>
                <th scope="row">{row.teacher}</th>
                <td className="num">{row.classes}</td>
                <td className="num">{row.consentedStudents}</td>
                <td className="num">{row.avgAccuracy}%</td>
                <td className="num">{fmtNumber(row.avgCardsWeek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{t('b2b.indicators.bySubject')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('b2b.indicators.subject')}</th>
              <th scope="col" className="num">
                {t('b2b.indicators.consentedStudents')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgAccuracy')}
              </th>
              <th scope="col" className="num">
                {t('b2b.indicators.avgCardsWeek')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ind.bySubject.map((row) => (
              <tr key={row.subject}>
                <th scope="row">{row.subject}</th>
                <td className="num">{row.consentedStudents}</td>
                <td className="num">{row.avgAccuracy}%</td>
                <td className="num">{fmtNumber(row.avgCardsWeek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.grid}>
        <div className={styles.tableWrap}>
          <table className={styles.table} style={{ minWidth: 0 }}>
            <caption>{t('b2b.indicators.bySemester')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('b2b.indicators.label')}</th>
                <th scope="col" className="num">
                  {t('b2b.indicators.avgAccuracy')}
                </th>
                <th scope="col" className="num">
                  {t('b2b.indicators.avgCardsWeek')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ind.bySemester.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.avgAccuracy}%</td>
                  <td className="num">{fmtNumber(row.avgCardsWeek)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table} style={{ minWidth: 0 }}>
            <caption>{t('b2b.indicators.byYear')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('b2b.indicators.label')}</th>
                <th scope="col" className="num">
                  {t('b2b.indicators.avgAccuracy')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ind.byYear.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.avgAccuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function UsersTab({ users, allowed }) {
  const t = useT()
  if (!allowed || !users) {
    return (
      <Banner tone="neutral" icon="lock">
        {t('b2b.users.restricted')}
      </Banner>
    )
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{t('b2b.users.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('b2b.users.name')}</th>
            <th scope="col">{t('b2b.users.email')}</th>
            <th scope="col">{t('b2b.users.role')}</th>
            <th scope="col">{t('b2b.users.subjects')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <th scope="row">{u.name}</th>
              <td>{u.email}</td>
              <td>
                <Badge tone="brand">{t(`b2b.login.roles.${u.role}`)}</Badge>
              </td>
              <td>{u.subjects ? u.subjects.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
