import { useNavigate } from 'react-router-dom'
import styles from './b2b.module.css'
import { Button, Badge, Chip, Wordmark, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDate } from '../../lib/format.js'
import { clearB2BSession, getB2BUser } from './b2bSession.js'

export function B2BShell({ overview, children }) {
  const t = useT()
  const navigate = useNavigate()
  const user = overview?.me || getB2BUser()
  const tenant = overview?.tenant

  const logout = () => {
    clearB2BSession()
    navigate('/b2b/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Wordmark size={22} to="/b2b/painel" />
            <span className={styles.panelName}>{t('b2b.name')}</span>
          </div>
          <div className={styles.headerUser}>
            {user ? (
              <>
                <span className={styles.userName}>{user.name}</span>
                <Badge tone="brand">{t(`b2b.login.roles.${user.role}`)}</Badge>
              </>
            ) : null}
            <Button variant="ghost" size="small" icon="logout" onClick={logout}>
              {t('b2b.header.logout')}
            </Button>
          </div>
        </div>
      </header>
      {tenant ? (
        <section className={styles.tenant} aria-label={t('b2b.header.tenant')}>
          <h1 className={styles.tenantName}>{tenant.name}</h1>
          <div className={styles.tenantMeta}>
            <Chip tone={tenant.dpa?.status === 'ativo' ? 'success' : 'warning'} icon="shield">
              {t('b2b.header.dpa')}: {t('b2b.header.dpaStatus', { version: tenant.dpa?.version, status: tenant.dpa?.status, date: fmtDate(tenant.dpa?.signedAt) })}
            </Chip>
            <Chip tone="neutral" icon="lock">
              {t('b2b.header.isolation')}: {tenant.isolation}
            </Chip>
            <Chip tone="neutral" icon="key">
              {t('b2b.header.sso')}: {tenant.sso}
            </Chip>
            <Chip tone="neutral" icon="receipt">
              {t('b2b.header.plan')}: {tenant.plan}
            </Chip>
          </div>
        </section>
      ) : null}
      <main className={styles.main}>{children}</main>
    </div>
  )
}

export function B2BState({ loading, error, onRetry }) {
  const t = useT()
  if (loading) {
    return (
      <div className={styles.stateBox} role="status">
        <Icon name="refresh" size={28} />
        <span>{t('b2b.states.loading')}</span>
      </div>
    )
  }
  if (error) {
    const message = error.status === 403 ? t('b2b.states.forbidden') : error.code === 'offline' ? t('b2b.states.offline') : error.message || t('b2b.states.error')
    return (
      <div className={styles.stateBox} role="alert">
        <Icon name="alert" size={28} />
        <span>{message}</span>
        {onRetry ? (
          <Button variant="ghost" icon="refresh" onClick={onRetry}>
            {t('b2b.states.retry')}
          </Button>
        ) : null}
      </div>
    )
  }
  return null
}
