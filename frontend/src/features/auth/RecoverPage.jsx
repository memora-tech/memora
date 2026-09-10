import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './auth.module.css'
import { Banner, Button, Input, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { publicApi } from '../../lib/api.js'

export function RecoverPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('auth.recover.title'))

  const submit = async (e) => {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email)) {
      setError(t('auth.login.errors.email'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await publicApi.post('/auth/password/recover', { email })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles.brandRow}>
        <Wordmark size={24} />
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.recover.title')}</h2>
        <p className={styles.subtitle}>{t('auth.recover.subtitle')}</p>
      </div>
      {sent ? (
        <Banner tone="success" icon="mail">
          {t('auth.recover.sent')}
        </Banner>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Input label={t('auth.recover.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" block loading={busy}>
            {t('auth.recover.submit')}
          </Button>
        </form>
      )}
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <Link to="/entrar" className={styles.footerLink}>
            {t('auth.recover.back')}
          </Link>
        </div>
      </div>
    </>
  )
}
