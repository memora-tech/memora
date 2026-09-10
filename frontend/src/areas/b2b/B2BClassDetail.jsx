import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './b2b.module.css'
import { Button, Badge, Chip, Banner, Surface, Stat, ConfirmDialog, SectionTitle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { b2bApi } from '../../lib/api.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { B2BShell, B2BState } from './B2BShell.jsx'
import { useB2BGuard } from './b2bSession.js'

export function B2BClassDetail() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const guard = useB2BGuard()
  const toast = useToast()
  const [revoking, setRevoking] = useState(null)
  const [busy, setBusy] = useState(false)

  const state = useAsync(async () => {
    try {
      const [overview, detail] = await Promise.all([b2bApi.get('/b2b/overview'), b2bApi.get(`/b2b/classes/${id}`)])
      return { overview, klass: detail.class }
    } catch (err) {
      if (!guard(err)) throw err
      return null
    }
  }, [id, guard])

  const klass = state.data?.klass
  const role = state.data?.overview?.me?.role
  const canRevoke = role === 'admin' || role === 'coordenador'
  useDocumentTitle(klass ? t('b2b.detail.title', { name: klass.name }) : t('b2b.name'))

  const revoke = async () => {
    if (!revoking) return
    setBusy(true)
    try {
      await b2bApi.post(`/b2b/students/${revoking.id}/revoke`)
      const students = klass.students.map((s) => (s.id === revoking.id ? { ...s, consent: false, projectionActive: false, metrics: null } : s))
      state.setData({ ...state.data, klass: { ...klass, students, consented: students.filter((s) => s.consent && s.projectionActive).length } })
      toast.show({ message: t('b2b.detail.revoked', { name: revoking.name }), icon: 'check' })
      setRevoking(null)
    } catch (err) {
      if (!guard(err)) toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <B2BShell overview={state.data?.overview}>
      <B2BState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {state.data && !klass ? <Banner tone="danger" icon="alert">{t('b2b.detail.notFound')}</Banner> : null}
      {klass ? (
        <>
          <div>
            <Button variant="text" icon="arrowLeft" onClick={() => navigate('/b2b/painel')}>
              {t('b2b.detail.back')}
            </Button>
          </div>
          <Surface className={styles.classCard}>
            <div className={styles.classHead}>
              <div>
                <h1 className={styles.classTitle}>{t('b2b.detail.title', { name: klass.name })}</h1>
                <div className={styles.metaList}>
                  <span>{t('b2b.classes.subject')}: {klass.subject}</span>
                  <span>{t('b2b.classes.room')}: {klass.room}</span>
                  <span>{t('b2b.classes.period', { year: klass.year, semester: klass.semester })}</span>
                  <span>{t('b2b.classes.teacher')}: {klass.teacherName}</span>
                </div>
              </div>
              <Chip tone="neutral" icon="users">
                {t('b2b.classes.students', { count: klass.total })}
              </Chip>
            </div>
            <Badge tone={klass.consented >= klass.minAggregate ? 'success' : 'warning'}>{t('b2b.classes.consented', { count: klass.consented })}</Badge>
            {klass.aggregates ? (
              <div className={styles.stats}>
                <Stat value={fmtNumber(klass.aggregates.activeStudents)} label={t('b2b.classes.activeStudents')} />
                <Stat value={`${klass.aggregates.avgAccuracy}%`} label={t('b2b.classes.avgAccuracy')} />
                <Stat value={fmtNumber(klass.aggregates.avgCardsWeek)} label={t('b2b.classes.avgCardsWeek')} />
                <Stat value={fmtNumber(klass.aggregates.studiedLast7Days)} label={t('b2b.classes.active7d')} />
              </div>
            ) : (
              <Banner tone="warning" icon="alert">
                <strong>{t('b2b.classes.blocked')}</strong> {klass.aggregateBlockedReason}
              </Banner>
            )}
          </Surface>
          <Banner tone="brand" icon="info">
            {t('b2b.rules.noRanking')}
          </Banner>
          {klass.students ? (
            <section aria-label={t('b2b.detail.students')} className={styles.stack}>
              <SectionTitle as="h2">{t('b2b.detail.students')}</SectionTitle>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption>{t('b2b.detail.caption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('b2b.detail.name')}</th>
                      <th scope="col">{t('b2b.detail.consent')}</th>
                      <th scope="col" className="num">{t('b2b.detail.cardsWeek')}</th>
                      <th scope="col" className="num">{t('b2b.detail.accuracy')}</th>
                      <th scope="col" className="num">{t('b2b.detail.streak')}</th>
                      <th scope="col">{t('b2b.detail.lastStudy')}</th>
                      {canRevoke ? <th scope="col">{t('b2b.detail.revoke')}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {klass.students.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">{s.name}</th>
                        <td>
                          {s.consent && s.projectionActive ? <Badge tone="success">{t('b2b.detail.consentYes')}</Badge> : s.consent === false && s.projectionActive === false && s.metrics === null ? <Badge tone="neutral">{t('b2b.detail.consentNo')}</Badge> : <Badge tone="neutral">{t('b2b.detail.consentNo')}</Badge>}
                        </td>
                        <td className="num">{s.metrics ? fmtNumber(s.metrics.cardsWeek) : '—'}</td>
                        <td className="num">{s.metrics ? `${s.metrics.accuracy}%` : '—'}</td>
                        <td className="num">{s.metrics ? s.metrics.streak : '—'}</td>
                        <td>{s.metrics ? fmtRelative(s.metrics.lastStudy) : '—'}</td>
                        {canRevoke ? (
                          <td>
                            {s.consent && s.projectionActive ? (
                              <Button variant="danger" size="small" onClick={() => setRevoking(s)}>
                                {t('b2b.detail.revoke')}
                              </Button>
                            ) : (
                              <span className={styles.userName}>{t('b2b.detail.revokedLabel')}</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.userName}>{t('b2b.detail.hidden')}</p>
            </section>
          ) : (
            <Banner tone="neutral" icon="lock">
              {t('b2b.detail.noIndividual')}
            </Banner>
          )}
          <ConfirmDialog open={Boolean(revoking)} onClose={() => setRevoking(null)} onConfirm={revoke} title={revoking ? t('b2b.detail.revokeTitle', { name: revoking.name }) : ''} confirmLabel={t('b2b.detail.revokeConfirm')} danger loading={busy}>
            <p>{t('b2b.detail.revokeText')}</p>
          </ConfirmDialog>
        </>
      ) : null}
    </B2BShell>
  )
}
