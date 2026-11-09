import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parentalApi } from '../../lib/api.js'
import { Button, Input, Banner, Icon } from '../../design-system/index.js'
import { PanelLogin, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

export function ParentalLogin() {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  useDocumentTitle(t('parental.name'))

  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!/.+@.+\..+/.test(email)) next.email = t('parental.login.errorEmail')
    if (!password) next.password = t('parental.login.errorPassword')
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    setFailed(false)
    try {
      const data = await parentalApi.post('/parental/auth/login', { email, password })
      parentalApi.setToken(data.token)
      navigate('/parental/painel', { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const highlights = t('parental.entry.highlights').map((text, i) => ({ text, icon: ['chart', 'shield', 'bell'][i] }))

  return (
    <PanelLogin product={t('parental.name')} kicker={t('parental.entry.kicker')} headline={t('parental.entry.headline')} highlights={highlights} footnote={t('parental.entry.footnote')}>
      <form onSubmit={submit} noValidate>
        <div>
          <h1>{t('parental.login.title')}</h1>
          <p className={panelStyles.loginSub}>{t('parental.login.subtitle')}</p>
        </div>
        <Input id="parental-email" type="email" label={t('parental.login.email')} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" inputMode="email" />
        <Input id="parental-password" type="password" label={t('parental.login.password')} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
        {failed ? (
          <Banner tone="danger" icon="alert">
            {t('parental.login.failed')}
          </Banner>
        ) : null}
        <Button type="submit" block size="large" loading={loading}>
          {t('parental.login.submit')}
        </Button>
        <p className={panelStyles.loginNote}>
          <Icon name="lock" size={16} />
          <span>{t('parental.login.hint')}</span>
        </p>
      </form>
    </PanelLogin>
  )
}
