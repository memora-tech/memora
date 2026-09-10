import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import styles from './admin.module.css'
import { Button, Badge, Wordmark, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { clearAdminSession, getAdminUser, sectionsFor } from './adminSession.js'

export function AdminLayout() {
  const t = useT()
  const navigate = useNavigate()
  const user = getAdminUser()
  const sections = sectionsFor(user?.role)

  const logout = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Wordmark size={22} to="/admin/painel" />
            <span className={styles.panelName}>{t('admin.name')}</span>
          </div>
          <div className={styles.headerUser}>
            {user ? (
              <>
                <span className={styles.userName}>{user.name}</span>
                <Badge tone="brand">{t(`admin.roles.${user.role}`)}</Badge>
                {user.areas?.length ? <span className={styles.userName}>{t('admin.header.areas', { areas: user.areas.join(', ') })}</span> : null}
              </>
            ) : null}
            <Button variant="ghost" size="small" icon="logout" onClick={logout}>
              {t('admin.header.logout')}
            </Button>
          </div>
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label={t('admin.nav.label')}>
          {sections.map((s) => (
            <NavLink key={s.key} to={s.key} className={styles.navLink} end={s.key !== 'moderacao'}>
              <Icon name={s.icon} size={18} />
              {t(`admin.nav.${s.key}`)}
            </NavLink>
          ))}
        </nav>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AdminHome() {
  const user = getAdminUser()
  const first = sectionsFor(user?.role)[0]
  return <Navigate to={first ? first.key : '/admin/login'} replace />
}
