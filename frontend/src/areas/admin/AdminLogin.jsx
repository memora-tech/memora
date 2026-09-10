import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Surface, Wordmark, Banner, Icon } from '../../design-system/index.js'
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

  return (
    <div className={styles.page}>
      <div className={styles.login}>
        <Surface className={styles.loginCard}>
          <form onSubmit={submit} className={styles.loginCard}>
            <div className={styles.loginHead}>
              <Wordmark size={28} />
              <span className={styles.panelName}>{t('admin.name')}</span>
              <h1 className={styles.loginTitle}>{t('admin.login.title')}</h1>
              <p className={styles.loginSub}>{t('admin.login.subtitle')}</p>
            </div>
            <div role="radiogroup" aria-label={t('admin.login.role')} className={styles.roleList}>
              {ADMIN_ROLES.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r ? 'true' : 'false'} className={styles.roleOption} onClick={() => setRole(r)}>
                  <Icon name={ROLE_ICONS[r]} size={18} />
                  <span>{t(`admin.roles.${r}`)}</span>
                  <span className={styles.cellMeta} style={{ marginLeft: 'auto' }}>
                    {SECTIONS.filter((s) => s.roles.includes(r) && s.key !== 'equipe').length}
                  </span>
                </button>
              ))}
            </div>
            <p className={styles.loginSub}>{t('admin.login.roleHint')}</p>
            {error ? (
              <Banner tone="danger" icon="alert">
                {error}
              </Banner>
            ) : null}
            <Button type="submit" block size="large" icon="key" loading={loading}>
              {t('admin.login.submit', { role: t(`admin.roles.${role}`) })}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  )
}
