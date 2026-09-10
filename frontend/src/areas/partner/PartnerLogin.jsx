import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { partnerApi } from '../../lib/api.js'
import { Button, Input, Wordmark, Banner } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import styles from './partner.module.css'

const formatCnpj = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function PartnerLogin() {
  const t = useT()
  const navigate = useNavigate()
  const [cnpj, setCnpj] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  useDocumentTitle(t('partner.name'))

  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (cnpj.replace(/\D/g, '').length !== 14) next.cnpj = t('partner.login.errorCnpj')
    if (!password) next.password = t('partner.login.errorPassword')
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    setFailed(false)
    try {
      const data = await partnerApi.post('/partner/auth/login', { cnpj, password })
      partnerApi.setToken(data.token)
      navigate('/parceiro/painel', { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.login}>
      <form className={styles.loginCard} onSubmit={submit} noValidate>
        <div className={styles.loginBrand}>
          <Wordmark size={28} />
          <span className={styles.loginPanel}>{t('partner.name')}</span>
        </div>
        <div>
          <h1 className={styles.loginTitle}>{t('partner.login.title')}</h1>
          <p className={styles.loginSub}>{t('partner.login.subtitle')}</p>
        </div>
        <div className={styles.form}>
          <Input id="partner-cnpj" label={t('partner.login.cnpj')} value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} error={errors.cnpj} inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" />
          <Input id="partner-password" type="password" label={t('partner.login.password')} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
          {failed ? (
            <Banner tone="danger" icon="alert">
              {t('partner.login.failed')}
            </Banner>
          ) : null}
          <Button type="submit" block size="large" loading={loading}>
            {t('partner.login.submit')}
          </Button>
          <p className={styles.loginSub}>{t('partner.login.hint')}</p>
        </div>
      </form>
    </main>
  )
}
