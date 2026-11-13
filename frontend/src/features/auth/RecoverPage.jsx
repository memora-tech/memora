import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import styles from './auth.module.css'
import { Banner, Button, Input, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { publicApi, studentApi } from '../../lib/api.js'
import { supabase } from '../../lib/supabase.js'

export function RecoverPage() {
  const t = useT()
  const [params] = useSearchParams()
  const isResetMode = params.get('mode') === 'reset'
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('auth.recover.title'))

  const submitEmail = async (e) => {
    e.preventDefault()
    if (!/.+@.+\..+/.test(email)) {
      setError(t('auth.login.errors.email'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/recuperar-senha?mode=reset`
      await publicApi.post('/auth/password/recover', { email, redirectTo })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitReset = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      setError(t('auth.recover.passwordError'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (supabase?.auth) {
        const { error: sbErr } = await supabase.auth.updateUser({ password: newPassword })
        if (sbErr) throw sbErr
      }
      if (studentApi.getToken()) {
        await studentApi.post('/me/password', { current: 'recovery', next: newPassword })
      }
      setResetDone(true)
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
      {isResetMode ? (
        resetDone ? (
          <Banner tone="success" icon="check">
            {t('auth.recover.resetDone')}
          </Banner>
        ) : (
          <form className={styles.form} onSubmit={submitReset} noValidate>
            <Input
              label={t('auth.recover.newPassword')}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={error}
            />
            <Button type="submit" block loading={busy}>
              {t('auth.recover.resetSubmit')}
            </Button>
          </form>
        )
      ) : sent ? (
        <Banner tone="success" icon="mail">
          {t('auth.recover.sent')}
        </Banner>
      ) : (
        <form className={styles.form} onSubmit={submitEmail} noValidate>
          <Input
            label={t('auth.recover.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
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
