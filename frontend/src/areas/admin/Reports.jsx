import { useState } from 'react'
import styles from './admin.module.css'
import { Button, Badge, Banner, Select, Textarea, Input, Surface, Sheet, EmptyState, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { fmtRelative } from '../../lib/format.js'
import { AdminState } from './AdminState.jsx'
import { useAdminData, useAdminGuard, getAdminUser } from './adminSession.js'

const ACTIONS = ['manter', 'remover', 'silenciar', 'banir']
const STATUS_TONE = { aberta: 'warning', resolvida: 'success', auto_resolvida: 'neutral', auto_analise: 'brand' }

export function Reports() {
  const t = useT()
  const guard = useAdminGuard()
  const toast = useToast()
  const me = getAdminUser()
  const canDecide = me?.role === 'moderador' || me?.role === 'engenharia'
  const [active, setActive] = useState(null)
  const [action, setAction] = useState('manter')
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('admin.reports.title'))

  const state = useAdminData(() => adminApi.get('/admin/moderation/reports'))
  const reports = state.data?.reports || []

  const openResolve = (report) => {
    setActive(report)
    setAction('manter')
    setReason('')
    setDuration('')
    setError(null)
  }

  const submit = async () => {
    if (action !== 'manter' && !reason.trim()) {
      setError(t('admin.reports.validation'))
      return
    }
    if ((action === 'silenciar' || action === 'banir') && !Number(duration)) {
      setError(t('admin.reports.validationDuration'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await adminApi.post(`/admin/moderation/reports/${active.id}/resolve`, { action, reason: reason.trim() || undefined, durationDays: Number(duration) || undefined })
      state.setData({ reports: reports.map((r) => (r.id === active.id ? res.report : r)) })
      toast.show({ message: t('admin.reports.done'), icon: 'check' })
      setActive(null)
    } catch (err) {
      if (!guard(err)) setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className={styles.title}>{t('admin.reports.title')}</h1>
      <Banner tone="brand" icon="info">
        {t('admin.reports.intro')}
      </Banner>
      <AdminState loading={state.loading} error={state.error} onRetry={() => state.run().catch(() => {})} />
      {state.data ? (
        reports.length ? (
          <div className={styles.list}>
            {reports.map((r) => (
              <Surface key={r.id} className={styles.stack}>
                <div className={styles.cardHead}>
                  <div className={styles.stack}>
                    <h2 className={styles.cardTitle}>{r.targetName}</h2>
                    <div className={styles.metaList}>
                      <span>{t(`admin.reports.target.${r.targetType}`)}</span>
                      <span>
                        {t('admin.reports.reason')}: {r.reason}
                      </span>
                      <span>
                        {t('admin.reports.reporter')}: {r.reporter}
                      </span>
                      <span>{t('admin.reports.reportedAt', { when: fmtRelative(r.createdAt) })}</span>
                    </div>
                    {r.detail ? <p>{r.detail}</p> : null}
                  </div>
                  <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{t(`admin.reports.status.${r.status}`)}</Badge>
                </div>
                {r.resolution ? (
                  <Banner tone="success" icon="check">
                    {t('admin.reports.resolution', {
                      action: t(`admin.reports.actions.${r.resolution.action}`),
                      reason: r.resolution.reason ? t('admin.reports.resolutionReason', { reason: r.resolution.reason }) : '',
                      duration: r.resolution.durationDays ? t('admin.reports.resolutionDuration', { days: r.resolution.durationDays }) : ''
                    })}{' '}
                    {r.resolution.appealChannel}
                  </Banner>
                ) : null}
                {r.status === 'aberta' && canDecide ? (
                  <div className={styles.formActions}>
                    <Button variant="soft" icon="check" onClick={() => openResolve(r)}>
                      {t('admin.reports.resolve')}
                    </Button>
                  </div>
                ) : null}
              </Surface>
            ))}
          </div>
        ) : (
          <EmptyState icon="flag" title={t('admin.reports.empty')} />
        )
      ) : null}
      <Sheet
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={t('admin.reports.resolveTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)}>
              {t('admin.common.cancel')}
            </Button>
            <Button onClick={submit} loading={busy} variant={action === 'banir' || action === 'remover' ? 'danger' : 'primary'}>
              {t('admin.reports.submit')}
            </Button>
          </>
        }
      >
        {active ? (
          <>
            <p className={styles.cellMeta}>{active.targetName}</p>
            <Select label={t('admin.reports.action')} value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {t(`admin.reports.actions.${a}`)}
                </option>
              ))}
            </Select>
            <Textarea label={t('admin.reports.reasonLabel')} hint={t('admin.reports.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} />
            {action === 'silenciar' || action === 'banir' ? <Input type="number" min="1" label={t('admin.reports.duration')} hint={t('admin.reports.durationHint')} value={duration} onChange={(e) => setDuration(e.target.value)} /> : null}
            <p className={styles.cellMeta}>{t('admin.reports.appealChannel')}</p>
            {error ? (
              <Banner tone="danger" icon="alert">
                {error}
              </Banner>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </>
  )
}
