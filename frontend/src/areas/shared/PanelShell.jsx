import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import styles from './panel.module.css'
import { Icon, Wordmark, EmptyState } from '../../design-system/index.js'

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function NavItem({ item }) {
  const content = (
    <>
      <Icon name={item.icon} size={18} />
      <span className={styles.navLabel}>{item.label}</span>
      {item.count ? (
        <span className={styles.navCount} data-tone={item.countTone || 'brand'}>
          {item.count}
          {item.countLabel ? <span className="sr-only"> {item.countLabel}</span> : null}
        </span>
      ) : null}
    </>
  )
  if (item.active !== undefined) {
    return (
      <Link to={item.to} className={styles.navItem} aria-current={item.active ? 'page' : undefined}>
        {content}
      </Link>
    )
  }
  return (
    <NavLink to={item.to} end={item.end} className={styles.navItem}>
      {content}
    </NavLink>
  )
}

export function PanelShell({ product, home, groups, user, onLogout, labels, children }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navId = useId()
  const toggleRef = useRef(null)
  const sidebarRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  const close = () => {
    setOpen(false)
    toggleRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={styles.shell} data-open={open ? 'true' : 'false'}>
      <a className="skip-link" href="#painel-conteudo">
        {labels.skip}
      </a>
      <header className={styles.mobileBar}>
        <div className={styles.mobileBrand}>
          <Wordmark size={20} to={home} className={styles.wordmark} />
          <span className={styles.productTag}>{product}</span>
        </div>
        <button ref={toggleRef} type="button" className={styles.menuButton} aria-expanded={open ? 'true' : 'false'} aria-controls={navId} onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? 'x' : 'list'} size={20} />
          <span className="sr-only">{labels.menu}</span>
        </button>
      </header>
      {open ? <button type="button" className={styles.scrim} tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <aside ref={sidebarRef} id={navId} className={styles.sidebar}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <Wordmark size={22} to={home} className={styles.wordmark} />
            <span className={styles.brandRule} aria-hidden="true" />
            <span className={styles.brandProduct}>{product}</span>
          </div>
          {open ? (
            <button ref={closeRef} type="button" className={styles.drawerClose} onClick={close}>
              <Icon name="x" size={20} />
              <span className="sr-only">{labels.close}</span>
            </button>
          ) : null}
        </div>
        <nav aria-label={labels.nav} className={styles.nav}>
          {groups.map((group) => (
            <div key={group.key} className={styles.navGroup}>
              {group.label ? <span className={styles.navGroupLabel}>{group.label}</span> : null}
              {group.items.map((item) => (
                <NavItem key={item.key} item={item} />
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          {user ? (
            <div className={styles.user}>
              <span className={styles.userAvatar} aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className={styles.userText}>
                <span className={styles.userName}>{user.name}</span>
                {user.meta ? <span className={styles.userMeta}>{user.meta}</span> : null}
              </span>
            </div>
          ) : null}
          <button type="button" className={styles.logout} onClick={onLogout}>
            <Icon name="logout" size={18} />
            <span>{labels.logout}</span>
          </button>
        </div>
      </aside>
      <main id="painel-conteudo" className={styles.main} tabIndex={-1}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  )
}

export function PanelLogin({ product, kicker, headline, highlights = [], footnote, children }) {
  return (
    <div className={styles.login}>
      <section className={styles.loginAside} aria-label={product}>
        <div className={styles.loginBrand}>
          <Wordmark size={26} className={styles.wordmark} />
          <span className={styles.brandRule} aria-hidden="true" />
          <span className={styles.brandProduct}>{product}</span>
        </div>
        <div className={styles.loginPitch}>
          {kicker ? <span className={styles.loginKicker}>{kicker}</span> : null}
          <p className={styles.loginHeadline}>{headline}</p>
          {highlights.length ? (
            <ul className={styles.loginHighlights}>
              {highlights.map((h) => (
                <li key={h.text}>
                  <span className={styles.loginHighlightIcon}>
                    <Icon name={h.icon} size={16} />
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {footnote ? <p className={styles.loginFootnote}>{footnote}</p> : null}
        <span className={styles.loginGlow} aria-hidden="true" />
      </section>
      <main className={styles.loginMain}>
        <div className={styles.loginCard}>{children}</div>
      </main>
    </div>
  )
}

export function Sparkline({ values, tone = 'brand', width = 120, height = 32 }) {
  if (!values?.length || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)])
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  const [lx, ly] = points[points.length - 1]
  return (
    <svg className={styles.spark} data-tone={tone} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      <path d={area} className={styles.sparkArea} />
      <path d={line} className={styles.sparkLine} />
      <circle cx={lx} cy={ly} r="2.6" className={styles.sparkDot} />
    </svg>
  )
}

export function Trend({ tone = 'neutral', icon, children }) {
  return (
    <span className={styles.trend} data-tone={tone}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

export function Meter({ value, max = 100, tone = 'brand', label }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <span className={styles.meter} data-tone={tone} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span className={styles.meterFill} style={{ width: `${pct}%` }} />
    </span>
  )
}

export function PanelEmpty({ icon, title, text, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyArt} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <EmptyState icon={icon} title={title} text={text} action={action} />
    </div>
  )
}

export { styles as panelStyles }
