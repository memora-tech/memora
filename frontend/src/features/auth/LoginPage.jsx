import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import styles from './auth.module.css'
import { Banner, Button, Input, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

export function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useDocumentTitle(t('auth.login.title'))
  const next = params.get('next') || '/app'

  const go = async (payload) => {
    setBusy(true)
    setFailed(false)
    try {
      await session.login(payload)
      navigate(next, { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const next = {}
    if (!/.+@.+\..+/.test(email)) next.email = t('auth.login.errors.email')
    if (!password) next.password = t('auth.login.errors.password')
    setErrors(next)
    if (Object.keys(next).length) return
    go({ provider: 'email', email, password })
  }

  return (
    <>
      <div className={styles.brandRow}>
        <Wordmark size={24} />
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.login.title')}</h2>
        <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>
      </div>
      {failed ? (
        <Banner tone="danger" icon="alert">
          {t('auth.login.errors.failed')}
        </Banner>
      ) : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input label={t('auth.login.email')} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label={t('auth.login.password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" block loading={busy}>
          {t('auth.login.submit')}
        </Button>
      </form>
      <div className={styles.divider}>{t('auth.login.or')}</div>
      <div className={styles.federated}>
        <Button variant="ghost" block onClick={() => go({ provider: 'google' })} loading={busy}>
          {t('auth.login.google')}
        </Button>
        <Button variant="ghost" block onClick={() => go({ provider: 'microsoft' })} loading={busy}>
          {t('auth.login.microsoft')}
        </Button>
        <Button variant="soft" block icon="zap" onClick={() => go({ provider: 'demo' })} loading={busy} aria-describedby="demo-hint">
          {t('auth.login.demo')}
        </Button>
        <p id="demo-hint" className={styles.meta}>
          {t('auth.login.demoHint')}
        </p>
      </div>
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <Link to="/recuperar-senha" className={styles.footerLink}>
            {t('auth.login.forgot')}
          </Link>
        </div>
        <div className={styles.footerRow}>
          <span>{t('auth.login.first')}</span>
          <Link to="/criar-conta" className={styles.footerLink}>
            {t('auth.login.create')}
          </Link>
        </div>
      </div>
    </>
  )
}
