import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './auth.module.css'
import { Badge, Button, Input, Wordmark, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

function ChannelForm({ channel, contact, verified, onConfirmed }) {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const confirm = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await session.confirm(channel, code)
      toast.show({ message: t('auth.confirm.confirmed'), icon: 'check' })
      onConfirmed?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (verified) {
    return (
      <div className={styles.step}>
        <Badge tone="success" icon="check">
          {t('auth.confirm.confirmed')}
        </Badge>
        <span className={styles.meta}>{t(`auth.confirm.${channel}`, { email: contact, phone: contact })}</span>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={confirm} noValidate>
      <Input label={t(`auth.confirm.${channel}`, { email: contact, phone: contact })} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} error={error} hint={t('auth.confirm.hint')} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Button type="submit" loading={busy} disabled={code.length < 6}>
          {t('auth.confirm.submit')}
        </Button>
        <Button
          type="button"
          variant="text"
          onClick={async () => {
            await session.resendCode(channel)
            toast.show({ message: t('auth.confirm.resent') })
          }}
        >
          {t('auth.confirm.resend')}
        </Button>
      </div>
    </form>
  )
}

export function ConfirmPage() {
  const t = useT()
  const navigate = useNavigate()
  const session = useSession()
  useDocumentTitle(t('auth.confirm.title'))
  const user = session.user
  const both = user?.verified?.email && user?.verified?.phone
  const fromRegister = session.flow === 'register'

  return (
    <>
      <div className={styles.brandRow}>
        <Wordmark size={24} />
        <div className={styles.progress} aria-hidden="true" style={{ width: 120 }}>
          <span data-done="true" />
          <span data-done="true" />
          <span />
          <span />
        </div>
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.confirm.title')}</h2>
        <p className={styles.subtitle}>{t('auth.confirm.subtitle')}</p>
      </div>
      {user ? (
        <>
          <ChannelForm channel="email" contact={user.email} verified={user.verified?.email} />
          <ChannelForm channel="phone" contact={user.phone} verified={user.verified?.phone} />
        </>
      ) : null}
      <div className={styles.footerActions}>
        <Button variant="text" onClick={() => navigate(fromRegister ? '/verificar-idade' : '/app')}>
          {t('auth.confirm.later')}
        </Button>
        <Button disabled={!both} onClick={() => navigate(fromRegister ? '/verificar-idade' : '/app')}>
          {t('auth.confirm.next')}
        </Button>
      </div>
    </>
  )
}
