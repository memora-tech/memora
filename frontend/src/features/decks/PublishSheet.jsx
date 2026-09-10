import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './decks.module.css'
import { Banner, Button, Chip, Sheet, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'
import { useSession } from '../../state/SessionContext.jsx'

export function PublishSheet({ open, onClose, deck, cardsCount, plan, onPublished }) {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const [policy, setPolicy] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState(null)
  const isVersion = deck?.publication?.status === 'aprovado'
  const slaHours = plan === 'premium' ? 24 : 72
  const needsPolicy = session.consents && session.consents.contentPolicyAcceptedVersion !== policy?.policy?.version

  useEffect(() => {
    if (open) {
      setGate(null)
      setAccepted(false)
      studentApi
        .get('/privacy/policy')
        .then(setPolicy)
        .catch(() => setPolicy(null))
    }
  }, [open])

  const publish = async () => {
    setBusy(true)
    try {
      const data = await studentApi.post(`/decks/${deck.id}/publish`, { acceptPolicy: accepted })
      toast.show({ message: t('decks.publish.queued', { hours: data.sla.hours }), icon: 'check', duration: 5000 })
      session.refresh()
      onPublished?.()
      onClose()
    } catch (err) {
      if (err.code === 'policy_acceptance_required') setGate({ type: 'policy' })
      else if (err.code === 'guardian_required') setGate({ type: 'guardian', request: err.body.request })
      else if (err.code === 'verification_required') setGate({ type: 'verify' })
      else if (err.code === 'empty_deck') setGate({ type: 'empty' })
      else toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isVersion ? t('decks.publish.versionTitle') : t('decks.publish.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button icon="globe" loading={busy} disabled={(needsPolicy && !accepted) || gate?.type === 'guardian'} onClick={publish}>
            {t('decks.publish.confirm')}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <strong>{t('decks.publish.summary')}</strong>
        <div className={styles.chips}>
          <Chip tone="brand">{deck?.categoryName}</Chip>
          <Chip tone="neutral">{t(`common.difficulty.${deck?.difficulty}`)}</Chip>
          <Chip tone="neutral">{t('decks.publish.cardsCount', { count: cardsCount })}</Chip>
          <Chip tone="reward" icon="clock">
            {t('decks.publish.sla', { hours: slaHours })}
          </Chip>
        </div>
        <p className={styles.meta}>{t('decks.publish.pipeline')}</p>
        <p className={styles.meta}>{t('decks.publish.versionNote')}</p>
        {needsPolicy ? (
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2 }} />
            <span>
              {t('decks.publish.policyAccept')} <strong>{t('decks.publish.policyTitle', { version: policy?.policy?.version || '' })}</strong>
              {policy?.summary ? (
                <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: 'disc', color: 'var(--color-text-secondary)', fontSize: 'var(--size-small)' }}>
                  {policy.summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </span>
          </label>
        ) : null}
        {gate?.type === 'policy' ? (
          <Banner tone="warning" icon="alert">
            {t('decks.publish.policyAccept')}
          </Banner>
        ) : null}
        {gate?.type === 'guardian' ? (
          <Banner tone="warning" icon="shield">
            {t('common.guardian.required')} {t('common.guardian.requestSent')}.
          </Banner>
        ) : null}
        {gate?.type === 'verify' ? (
          <Banner tone="warning" icon="shield" action={<Button size="small" variant="soft" onClick={() => navigate('/confirmar')}>{t('common.verification.cta')}</Button>}>
            {t('decks.publish.verifyFirst')}
          </Banner>
        ) : null}
        {gate?.type === 'empty' ? (
          <Banner tone="danger" icon="alert">
            {t('decks.publish.empty')}
          </Banner>
        ) : null}
      </div>
    </Sheet>
  )
}
