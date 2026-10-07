import { useState } from 'react'
import styles from './profile.module.css'
import { Badge, Banner, Button, ConfirmDialog, PageHeader, Sheet, Skeleton, Surface, Textarea, Toggle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate, fmtDateTime } from '../../lib/format.js'

export function PrivacyPage() {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const exportsQ = useAsync(() => studentApi.get('/privacy/export'), [])
  const decisions = useAsync(() => studentApi.get('/privacy/decisions'), [])
  const policy = useAsync(() => studentApi.get('/privacy/policy'), [])
  const [dialog, setDialog] = useState(null)
  const [decisionsOpen, setDecisionsOpen] = useState(false)
  const [contesting, setContesting] = useState(null)
  const [contestText, setContestText] = useState('')
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('profile.privacy.title'))
  const consents = session.consents
  const user = session.user

  const guardianErr = (err) => {
    if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
    else toast.show({ message: err.message, tone: 'danger' })
  }

  const requestExport = async () => {
    setBusy(true)
    try {
      await studentApi.post('/privacy/export')
      exportsQ.run()
      toast.show({ message: t('common.state.saved'), icon: 'check' })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async () => {
    setBusy(true)
    try {
      await studentApi.post('/privacy/delete')
      setDialog(null)
      await session.refresh()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const reactivate = async () => {
    try {
      await studentApi.post('/privacy/reactivate')
      toast.show({ message: t('profile.privacy.reactivated'), icon: 'check' })
      await session.refresh()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const contest = async () => {
    setBusy(true)
    try {
      const data = await studentApi.post(`/privacy/decisions/${contesting.id}/contest`, { text: contestText })
      toast.show({ message: t('profile.privacy.contestSent', { date: fmtDate(data.decision.contested.dueBy) }), icon: 'check', duration: 6000 })
      setContesting(null)
      setContestText('')
      decisions.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const revert = async (d) => {
    try {
      await studentApi.post(`/noa/decisions/${d.id}/revert`)
      toast.show({ message: t('profile.privacy.reverted'), icon: 'check' })
      decisions.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (!consents || !user) return <Skeleton height={160} count={2} />

  const deletion = user.deactivatedAt
  const purgeAt = deletion ? new Date(new Date(deletion).getTime() + 30 * 86400000).toISOString() : null
  const exportReq = exportsQ.data?.requests?.[0]

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.privacy.title')} backTo="/app/perfil" backLabel={t('profile.title')} />

      {deletion ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={reactivate}>{t('profile.privacy.reactivate')}</Button>}>
          {t('profile.privacy.deleted', { date: fmtDate(purgeAt) })}
        </Banner>
      ) : null}

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.privacy.consents')}</h2>
        <Toggle checked={consents.schoolShare} onChange={(v) => session.updateConsents({ schoolShare: v }).catch(guardianErr)} label={t('profile.privacy.school')} help={t('profile.privacy.schoolHelp')} />
        <h3 style={{ fontSize: 'var(--size-body)' }}>{t('profile.privacy.whatsapp')}</h3>
        {['lembretes', 'conquistas', 'conta', 'informativo'].map((cat) => (
          <Toggle key={cat} checked={Boolean(consents.whatsapp?.[cat])} onChange={(v) => session.updateConsents({ whatsapp: { [cat]: v } }).catch(guardianErr)} label={t(`profile.privacy.whatsappCats.${cat}`)} lockedReason={cat === 'informativo' && user.isMinor && !user.guardianPermissions?.whatsappInfo ? t('common.guardian.required') : undefined} />
        ))}
        <p className={styles.meta}>{t('profile.privacy.whatsappNote')}</p>
      </Surface>

      <Surface className={styles.stack}>
        <div className={styles.sectionTitle}>
          <h2 style={{ fontSize: 'var(--size-heading)' }}>{t('profile.privacy.decisions')}</h2>
          {decisions.data ? <Badge tone="noa">{decisions.data.catalogVersion}</Badge> : null}
        </div>
        <p className={styles.meta}>{t('profile.privacy.decisionsText')}</p>
        {(decisionsOpen ? decisions.data?.decisions || [] : (decisions.data?.decisions || []).slice(0, 1)).map((d) => (
          <div key={d.id} className={styles.decision}>
            <span className={styles.meta}>
              {fmtDateTime(d.at)} · {d.action?.name || d.actionKey}
              {d.action?.autonomous ? ` · ${t('profile.privacy.autonomous')}` : ''}
              {d.accepted ? ` · ${t('profile.privacy.accepted')}` : ''}
            </span>
            <span>{d.text}</span>
            {d.contested ? <Badge tone="warning">{t('profile.privacy.contested', { date: fmtDate(d.contested.at) })}</Badge> : null}
            <div className={styles.actions}>
              {d.reversible && !d.reverted ? (
                <Button size="small" variant="ghost" icon="refresh" onClick={() => revert(d)}>
                  {t('profile.privacy.revert')}
                </Button>
              ) : d.reverted ? (
                <Badge>{t('profile.privacy.reverted')}</Badge>
              ) : null}
              {!d.contested ? (
                <Button size="small" variant="text" onClick={() => setContesting(d)}>
                  {t('profile.privacy.contest')}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {(decisions.data?.decisions || []).length > 1 ? (
          <Button variant="text" size="small" icon={decisionsOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setDecisionsOpen((v) => !v)}>
            {decisionsOpen ? t('profile.privacy.decisionsLess') : t('profile.privacy.decisionsMore', { count: decisions.data.decisions.length - 1 })}
          </Button>
        ) : null}
      </Surface>

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.privacy.export')}</h2>
        <p className={styles.meta}>{t('profile.privacy.exportText')}</p>
        {exportReq ? <Banner tone="brand" icon="download">{t('profile.privacy.exportRequested', { date: fmtDate(exportReq.requestedAt), due: fmtDate(exportReq.dueBy), status: t(`profile.privacy.exportStatus.${exportReq.status}`) })}</Banner> : null}
        <Button variant="soft" icon="download" loading={busy} onClick={requestExport}>
          {t('profile.privacy.export')}
        </Button>
      </Surface>

      <Surface className={styles.stack}>
        <p className={styles.meta}>{t('profile.privacy.retention')}</p>
        <p className={styles.meta}>{t('profile.privacy.ai')}</p>
        {policy.data ? (
          <p className={styles.meta}>
            {t('profile.privacy.policy', { version: policy.data.policy.version })} · {t('profile.privacy.dpo', { email: policy.data.dpo?.email || '' })}
          </p>
        ) : null}
      </Surface>

      {!deletion ? (
        <Button variant="danger" icon="trash" onClick={() => setDialog('delete')}>
          {t('profile.privacy.delete')}
        </Button>
      ) : null}

      <ConfirmDialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={t('profile.privacy.deleteTitle')} confirmLabel={t('profile.privacy.delete')} danger loading={busy} onConfirm={deleteAccount}>
        <p>{t('profile.privacy.deleteText')}</p>
        <ul className={styles.effects}>
          {(Array.isArray(t('profile.privacy.deleteEffects')) ? t('profile.privacy.deleteEffects') : []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </ConfirmDialog>

      <Sheet
        open={Boolean(contesting)}
        onClose={() => setContesting(null)}
        title={t('profile.privacy.contestTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setContesting(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!contestText.trim()} onClick={contest}>
              {t('profile.privacy.contest')}
            </Button>
          </>
        }
      >
        <p className={styles.meta}>{contesting?.text}</p>
        <Textarea label={t('profile.privacy.contestText')} value={contestText} onChange={(e) => setContestText(e.target.value)} rows={4} autoFocus />
      </Sheet>
    </div>
  )
}
