import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './auth.module.css'
import { Banner, Button, Field, Input, Segmented, Select, Wordmark, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

export function RegisterPage() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const session = useSession()
  const [form, setForm] = useState({ name: '', email: '', phone: '', birthDate: '', student: null, origin: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [captcha, setCaptcha] = useState(false)
  useDocumentTitle(t('auth.register.title'))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = t('auth.register.errors.name')
    if (!/.+@.+\..+/.test(form.email)) next.email = t('auth.register.errors.email')
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) next.phone = t('auth.register.errors.phone')
    if (!form.birthDate) next.birthDate = t('auth.register.errors.birthDate')
    if (form.student === null) next.student = t('auth.register.errors.student')
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await session.register({ ...form, student: form.student === 'sim', captchaToken: captcha ? 'ok' : undefined })
      toast.show({ message: t('auth.register.created'), icon: 'check' })
      navigate('/confirmar', { replace: true })
    } catch (err) {
      if (err.code === 'captcha_required') setCaptcha(true)
      else if (err.body?.errors) setErrors(Object.fromEntries(Object.entries(err.body.errors).map(([k, v]) => [k, v])))
      else toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const origins = t('auth.register.originOptions')

  return (
    <>
      <div className={styles.brandRow}>
        <Wordmark size={24} />
        <div className={styles.progress} aria-hidden="true" style={{ width: 120 }}>
          <span data-done="true" />
          <span />
          <span />
          <span />
        </div>
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.register.title')}</h2>
        <p className={styles.subtitle}>{t('auth.register.subtitle')}</p>
      </div>
      {captcha ? (
        <Banner tone="warning" icon="shield" action={<Button size="small" variant="soft" onClick={() => setCaptcha('solved')}>{t('auth.register.captchaSolve')}</Button>}>
          {t('auth.register.captcha')}
        </Banner>
      ) : null}
      {Object.keys(errors).length ? (
        <Banner tone="danger" icon="alert">
          {t('auth.register.errors.fix')}
        </Banner>
      ) : null}
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input label={t('auth.register.name')} autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <Input label={t('auth.register.email')} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Input label={t('auth.register.phone')} type="tel" autoComplete="tel" inputMode="tel" placeholder="(11) 90000-0000" hint={t('auth.register.phoneHint')} value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Input label={t('auth.register.birthDate')} type="date" autoComplete="bday" hint={`${t('auth.register.birthHint')} ${t('auth.register.minAge')}`} value={form.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
        <Field label={t('auth.register.student')} error={errors.student}>
          {() => <Segmented label={t('auth.register.student')} value={form.student} onChange={(v) => setForm((f) => ({ ...f, student: v }))} options={[{ value: 'sim', label: t('auth.register.yes') }, { value: 'nao', label: t('auth.register.no') }]} />}
        </Field>
        <Select label={t('auth.register.origin')} optional value={form.origin} onChange={set('origin')}>
          <option value="">{t('auth.register.originNone')}</option>
          {Array.isArray(origins) ? origins.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          )) : null}
        </Select>
        <Button type="submit" block loading={busy}>
          {t('auth.register.submit')}
        </Button>
      </form>
      <div className={styles.footer}>
        <div className={styles.footerRow}>
          <span>{t('auth.register.already')}</span>
          <Link to="/entrar" className={styles.footerLink}>
            {t('auth.register.login')}
          </Link>
        </div>
      </div>
    </>
  )
}
