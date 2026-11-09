import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Segmented, Select, Banner, Icon } from '../../design-system/index.js'
import { PanelLogin, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { b2bApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { saveB2BUser } from './b2bSession.js'

const ROLES = ['admin', 'coordenador', 'professor', 'leitura']

export function B2BLogin() {
  const t = useT()
  const navigate = useNavigate()
  const [provider, setProvider] = useState('google')
  const [role, setRole] = useState('coordenador')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  useDocumentTitle(t('b2b.name'))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await b2bApi.post('/b2b/auth/login', { provider, role })
      b2bApi.setToken(res.token)
      saveB2BUser(res.user)
      navigate('/b2b/painel', { replace: true })
    } catch (err) {
      setError(err.message || t('b2b.login.error'))
    } finally {
      setLoading(false)
    }
  }

  const providerLabel = provider === 'google' ? t('b2b.login.google') : t('b2b.login.microsoft')

  const icons = ['key', 'users', 'route']
  const highlights = t('b2b.entry.highlights').map((text, i) => ({ text, icon: icons[i] }))

  return (
    <PanelLogin product={t('b2b.name')} kicker={t('b2b.entry.kicker')} headline={t('b2b.entry.headline')} highlights={highlights} footnote={t('b2b.entry.footnote')}>
      <form onSubmit={submit}>
        <div>
          <h1>{t('b2b.login.title')}</h1>
          <p className={panelStyles.loginSub}>{t('b2b.login.subtitle')}</p>
        </div>
        <Segmented
          label={t('b2b.login.provider')}
          value={provider}
          onChange={setProvider}
          options={[
            { value: 'google', label: t('b2b.login.google'), icon: 'globe' },
            { value: 'microsoft', label: t('b2b.login.microsoft'), icon: 'building' }
          ]}
        />
        <Select label={t('b2b.login.role')} hint={t('b2b.login.roleHint')} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`b2b.login.roles.${r}`)}
            </option>
          ))}
        </Select>
        {error ? (
          <Banner tone="danger" icon="alert">
            {error}
          </Banner>
        ) : null}
        <Button type="submit" block size="large" icon="key" loading={loading}>
          {t('b2b.login.submit', { provider: providerLabel })}
        </Button>
        <p className={panelStyles.loginNote}>
          <Icon name="shield" size={16} />
          <span>{t('b2b.login.dpaNote')}</span>
        </p>
      </form>
    </PanelLogin>
  )
}
