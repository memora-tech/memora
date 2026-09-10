import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Chip, Input, Surface, Sheet, SectionTitle, Stat, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard } from './adminSession.js'

const INCIDENT_TONE = { aberto: 'danger', comunicado: 'warning', encerrado: 'success' }

export function Compliance() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [affected, setAffected] = useState(null)
  useDocumentTitle(t('admin.compliance.title'))
  const state = useAdminData(() => adminApi.get('/admin/compliance/overview'))
  const data = state.data

  const createIncident = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setFormError(t('admin.compliance.validation'))
      return
    }
    setBusy('new')
    setFormError(null)
    try {
      const res = await adminApi.post('/admin/compliance/incidents', { title: title.trim() })
      state.setData({ ...data, incidents: [res.incident, ...data.incidents] })
      setTitle('')
      toast.show({ message: t('admin.compliance.incidentCreated'), icon: 'check' })
    } catch (err) {
      if (!guard(err)) setFormError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const listAffected = async (incident) => {
    setBusy(`aff_${incident.id}`)
    try {
      const res = await adminApi.get(`/admin/compliance/incidents/${incident.id}/affected`)
      setAffected(res)
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const notify = async (incident, target) => {
    setBusy(`${target}_${incident.id}`)
    try {
      const res = await adminApi.post(`/admin/compliance/incidents/${incident.id}/notify`, { target })
      state.setData({ ...data, incidents: data.incidents.map((i) => (i.id === incident.id ? res.incident : i)) })
      toast.show({ message: t('admin.compliance.notified'), icon: 'send' })
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <h1 className={styles.title}>{t('admin.compliance.title')}</h1>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {data ? (
        <>
          <Banner tone={data.chain.ok ? 'success' : 'danger'} icon={data.chain.ok ? 'shield' : 'alert'}>
            {data.chain.ok ? t('admin.compliance.chainOk', { count: data.chain.length, years: data.retention.auditYears }) : t('admin.compliance.chainBroken', { seq: data.chain.brokenAt })}
          </Banner>
          <div className={styles.chips}>
            <Chip tone="neutral" icon="archive">
              {t('admin.compliance.retentionAudit', { years: data.retention.auditYears })}
            </Chip>
            <Chip tone="neutral" icon="idCard">
              {t('admin.compliance.retentionDocs', { hours: data.retention.documentsHours })}
            </Chip>
            <Chip tone="neutral" icon="file">
              {t('admin.compliance.retentionOriginals', { days: data.retention.originalsDays })}
            </Chip>
            <Chip tone="neutral" icon="receipt">
              {t('admin.compliance.retentionFiscal', { years: data.retention.fiscalYears })}
            </Chip>
          </div>
          <div className={styles.grid2}>
            <Surface className={styles.stack}>
              <SectionTitle as="h2" action={<Badge tone={data.dpo.replacementDue ? 'warning' : 'success'}>{data.dpo.replacementDue ? t('admin.compliance.dpoDue') : t('admin.compliance.dpoOk')}</Badge>}>
                {t('admin.compliance.dpo')}
              </SectionTitle>
              <dl className={styles.definition}>
                <dt>{t('admin.compliance.dpo')}</dt>
                <dd>{data.dpo.name}</dd>
                <dt>{t('admin.support.email')}</dt>
                <dd className={styles.mono}>{data.dpo.email}</dd>
                <dt>{t('admin.common.date')}</dt>
                <dd>{t('admin.compliance.dpoAppointed', { date: fmtDate(data.dpo.appointedAt) })}</dd>
                <dt>{t('admin.compliance.dpoTrigger')}</dt>
                <dd>{data.dpo.replacementTrigger}</dd>
              </dl>
              <div className={styles.chips}>
                <Chip tone={data.dpo.accounts >= 10000 ? 'warning' : 'neutral'}>{t('admin.compliance.dpoAccounts', { accounts: fmtNumber(data.dpo.accounts) })}</Chip>
                <Chip tone={data.dpo.b2bSigned >= 1 ? 'warning' : 'neutral'}>{t('admin.compliance.dpoB2B', { count: data.dpo.b2bSigned })}</Chip>
              </div>
            </Surface>
            <Surface className={styles.stack}>
              <SectionTitle as="h2">{t('admin.compliance.policy')}</SectionTitle>
              <p className={styles.cellMeta}>{t('admin.compliance.policyVersion', { version: data.policy.version, date: fmtDate(data.policy.publishedAt) })}</p>
              <span className={styles.snapLabel}>{t('admin.compliance.policyChanges')}</span>
              <ul className={styles.stack}>
                {data.policy.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className={styles.statsRow}>
                <Stat value={fmtNumber(data.decisionsContested)} label={t('admin.compliance.contested')} />
              </div>
            </Surface>
          </div>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.compliance.incidents')}</SectionTitle>
            <p className={styles.cellMeta}>{t('admin.compliance.incidentsIntro')}</p>
            <form onSubmit={createIncident} className={styles.toolbar}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <Input label={t('admin.compliance.incidentTitle')} value={title} onChange={(e) => setTitle(e.target.value)} error={formError} />
              </div>
              <Button type="submit" icon="plus" loading={busy === 'new'}>
                {t('admin.compliance.newIncident')}
              </Button>
            </form>
            <ul className={styles.list}>
              {data.incidents.map((inc) => (
                <li key={inc.id}>
                  <Surface tone="sunken" className={styles.stack}>
                    <div className={styles.cardHead}>
                      <div className={styles.stack}>
                        <h3 className={styles.cardTitle}>{inc.title}</h3>
                        <div className={styles.metaList}>
                          <span>{t('admin.compliance.detected', { when: fmtRelative(inc.detectedAt) })}</span>
                          <span>{t('admin.compliance.affected', { count: inc.affected })}</span>
                          <span>{t('admin.compliance.minors', { count: inc.minorsAffected })}</span>
                          <span>{t('admin.compliance.runbook', { code: inc.runbook })}</span>
                        </div>
                      </div>
                      <Badge tone={INCIDENT_TONE[inc.status] || 'neutral'}>{t(`admin.compliance.incidentStatus.${inc.status}`)}</Badge>
                    </div>
                    <div className={styles.metaList}>
                      <span>{inc.anpdNotifiedAt ? t('admin.compliance.notifiedAnpd', { when: fmtRelative(inc.anpdNotifiedAt) }) : inc.anpdDeadline ? `ANPD · ${t('admin.compliance.deadline', { date: fmtDateTime(inc.anpdDeadline) })}` : null}</span>
                      <span>{inc.holdersNotifiedAt ? t('admin.compliance.notifiedHolders', { when: fmtRelative(inc.holdersNotifiedAt) }) : inc.holdersDeadline ? `${t('admin.compliance.subject')} · ${t('admin.compliance.deadline', { date: fmtDateTime(inc.holdersDeadline) })}` : null}</span>
                    </div>
                    <div className={styles.inlineActions}>
                      <Button variant="ghost" size="small" icon="users" onClick={() => listAffected(inc)} loading={busy === `aff_${inc.id}`}>
                        {t('admin.compliance.listAffected')}
                      </Button>
                      <Button variant="soft" size="small" icon="send" disabled={Boolean(inc.anpdNotifiedAt)} onClick={() => notify(inc, 'anpd')} loading={busy === `anpd_${inc.id}`}>
                        {t('admin.compliance.notifyAnpd')}
                      </Button>
                      <Button variant="soft" size="small" icon="mail" disabled={Boolean(inc.holdersNotifiedAt)} onClick={() => notify(inc, 'titulares')} loading={busy === `titulares_${inc.id}`}>
                        {t('admin.compliance.notifyHolders')}
                      </Button>
                    </div>
                  </Surface>
                </li>
              ))}
            </ul>
          </Surface>
          <Surface className={styles.stack}>
            <SectionTitle as="h2">{t('admin.compliance.conscious')}</SectionTitle>
            <ul className={styles.stack}>
              {data.consciousDecisions.map((d) => (
                <li key={d.topic} className={styles.cellStack}>
                  <strong>{d.topic}</strong>
                  <span>{d.decision}</span>
                  <span className={styles.cellMeta}>{fmtDate(d.recordedAt)}</span>
                </li>
              ))}
            </ul>
          </Surface>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.compliance.auditLog')} · {t('admin.compliance.auditCaption')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.compliance.seq')}</th>
                  <th scope="col">{t('admin.compliance.ts')}</th>
                  <th scope="col">{t('admin.compliance.actor')}</th>
                  <th scope="col">{t('admin.compliance.action')}</th>
                  <th scope="col">{t('admin.compliance.target')}</th>
                  <th scope="col">{t('admin.compliance.hash')}</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLog.map((e) => (
                  <tr key={e.seq}>
                    <td className={styles.num}>{e.seq}</td>
                    <td>{fmtDateTime(e.ts)}</td>
                    <td>
                      {e.actor} <span className={styles.cellMeta}>{e.actorRole}</span>
                    </td>
                    <td className={styles.mono}>{e.action}</td>
                    <td className={styles.mono}>{e.target}</td>
                    <td className={styles.mono}>{e.hash.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>
                {t('admin.compliance.accessLog')} · {t('admin.compliance.accessCaption')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.compliance.ts')}</th>
                  <th scope="col">{t('admin.compliance.operator')}</th>
                  <th scope="col">{t('admin.compliance.subject')}</th>
                  <th scope="col">{t('admin.compliance.purpose')}</th>
                  <th scope="col">{t('admin.compliance.fields')}</th>
                </tr>
              </thead>
              <tbody>
                {data.accessLog.length ? (
                  data.accessLog.map((a, i) => (
                    <tr key={i}>
                      <td>{fmtDateTime(a.ts)}</td>
                      <td>
                        {a.operator} <span className={styles.cellMeta}>{a.operatorRole}</span>
                      </td>
                      <td className={styles.mono}>{a.subjectUserId}</td>
                      <td>{a.purpose}</td>
                      <td>{a.fields.join(', ')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.cellMeta}>
                      {t('admin.compliance.emptyAccess')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <Sheet open={Boolean(affected)} onClose={() => setAffected(null)} title={affected ? t('admin.compliance.affectedTitle', { title: affected.incident.title }) : ''}>
        {affected ? (
          <>
            <Banner tone="warning" icon="users">
              {t('admin.compliance.affectedSummary', { total: affected.total, minors: affected.minors })}
            </Banner>
            <ul className={styles.stack}>
              {affected.affected.map((u) => (
                <li key={u.id} className={styles.cardHead}>
                  <span>
                    {u.name} <span className={`${styles.cellMeta} ${styles.mono}`}>{u.email}</span>
                  </span>
                  {u.isMinor ? <Badge tone="brand">{t('admin.support.minor')}</Badge> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Sheet>
    </>
  )
}
