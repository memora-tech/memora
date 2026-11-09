import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Banner, Icon } from '../../design-system/index.js'
import { PanelLogin, panelStyles } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { adminApi } from '../../lib/api.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { ADMIN_ROLES, SECTIONS, saveAdminUser } from './adminSession.js'

const ROLE_ICONS = { moderador: 'shield', suporte_n1: 'help', suporte_n2: 'help', comercial: 'building', financeiro: 'receipt', compliance: 'lock', engenharia: 'zap' }

export function AdminLogin() {
  const t = useT()
  const navigate = useNavigate()
  const [role, setRole] = useState('moderador')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  useDocumentTitle(t('admin.name'))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.post('/admin/auth/login', { role })
      adminApi.setToken(res.token)
      saveAdminUser(res.user)
      navigate('/admin/painel', { replace: true })
    } catch (err) {
      setError(err.message || t('admin.login.error'))
    } finally {
      setLoading(false)
    }
  }

  const highlights = t('admin.entry.highlights')
  const icons = ['key', 'eye', 'route']

  return (
    <PanelLogin product={t('admin.name')} kicker={t('admin.entry.kicker')} headline={t('admin.entry.headline')} highlights={highlights.map((text, i) => ({ text, icon: icons[i] }))} footnote={t('admin.entry.footnote')}>
      <form onSubmit={submit}>
        <div>
          <h1>{t('admin.login.title')}</h1>
          <p className={panelStyles.loginSub}>{t('admin.login.subtitle')}</p>
        </div>
        <fieldset className={styles.roleField}>
          <legend className={panelStyles.label}>{t('admin.login.role')}</legend>
          <div role="radiogroup" aria-label={t('admin.login.role')} className={styles.roleList}>
            {ADMIN_ROLES.map((r) => {
              const count = SECTIONS.filter((s) => s.roles.includes(r) && s.key !== 'equipe').length
              return (
                <button key={r} type="button" role="radio" aria-checked={role === r ? 'true' : 'false'} className={styles.roleOption} onClick={() => setRole(r)}>
                  <span className={styles.roleIcon}>
                    <Icon name={ROLE_ICONS[r]} size={16} />
                  </span>
                  <span className={styles.roleName}>{t(`admin.roles.${r}`)}</span>
                  <span className={styles.roleCount}>{t('admin.entry.sections', { count })}</span>
                  <span className={styles.roleCheck} aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
        {error ? (
          <Banner tone="danger" icon="alert">
            {error}
          </Banner>
        ) : null}
        <Button type="submit" block size="large" icon="key" loading={loading}>
          {t('admin.login.submit', { role: t(`admin.roles.${role}`) })}
        </Button>
        <p className={panelStyles.loginNote}>
          <Icon name="info" size={16} />
          <span>{t('admin.login.roleHint')}</span>
        </p>
      </form>
    </PanelLogin>
  )
}
