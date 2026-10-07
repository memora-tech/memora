import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './student.module.css'
import { ConfirmDialog, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'

const ITEMS = [
  { key: 'profile', icon: 'user', to: '/app/perfil' },
  { key: 'settings', icon: 'settings', to: '/app/perfil/configuracoes' },
  { key: 'connections', icon: 'plug', to: '/app/perfil/conexoes' },
  { key: 'wallet', icon: 'wallet', to: '/app/carteira' },
  { key: 'subscription', icon: 'zap', to: '/app/perfil/assinatura' },
  { key: 'support', icon: 'help', to: '/app/perfil/suporte' }
]

export function UserMenu() {
  const t = useT()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const buttonRef = useRef(null)
  const itemRefs = useRef([])
  const wrapRef = useRef(null)
  const user = session.user
  const active = location.pathname.startsWith('/app/perfil') || location.pathname.startsWith('/app/carteira')
  const total = ITEMS.length + 1

  useEffect(() => {
    if (!open) return undefined
    itemRefs.current[0]?.focus()
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const onMenuKey = (e) => {
    const index = itemRefs.current.indexOf(document.activeElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[(index + 1) % total]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[(index - 1 + total) % total]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      itemRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      itemRefs.current[total - 1]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  const go = (to) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className={styles.userMenuWrap} ref={wrapRef}>
      {open ? (
        <div id={menuId} role="menu" aria-label={t('common.userMenu.label')} className={styles.userMenu} onKeyDown={onMenuKey}>
          <div className={styles.userMenuHead}>
            <span className={styles.userMenuName}>{user?.name}</span>
            <span className={styles.userMenuEmail}>{user?.email}</span>
          </div>
          {ITEMS.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className={styles.userMenuItem}
              aria-current={location.pathname === item.to ? 'page' : undefined}
              onClick={() => go(item.to)}
            >
              <Icon name={item.icon} size={18} />
              <span>{t(`common.userMenu.${item.key}`)}</span>
              {item.key === 'connections' ? <span className={styles.railBadge}>MCP</span> : null}
            </button>
          ))}
          <span className={styles.userMenuSep} role="separator" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            ref={(el) => {
              itemRefs.current[ITEMS.length] = el
            }}
            className={styles.userMenuItem}
            onClick={() => {
              setOpen(false)
              setLogoutOpen(true)
            }}
          >
            <Icon name="logout" size={18} />
            <span>{t('profile.logout')}</span>
          </button>
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={styles.railUser}
        data-active={active ? 'true' : 'false'}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={styles.railAvatar} aria-hidden="true">
          {(user?.name || '?').slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.railUserText}>
          <span className={styles.railUserName}>{user?.name}</span>
          <span className={styles.railUserMeta}>{t(`common.nav.plan.${user?.plan || 'free'}`)}</span>
        </span>
        <Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} />
      </button>
      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={t('profile.logoutTitle')}
        confirmLabel={t('profile.logout')}
        onConfirm={async () => {
          await session.logout()
          navigate('/entrar', { replace: true })
        }}
      >
        <p>{t('profile.logoutText')}</p>
      </ConfirmDialog>
    </div>
  )
}
