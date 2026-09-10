import styles from './ds.module.css'
import { Icon } from './Icon.jsx'
import { Link } from 'react-router-dom'
import { useT } from '../i18n/index.js'

export function Surface({ children, tone, interactive, onClick, to, className, as, ...rest }) {
  const toneClass = { sunken: styles.surfaceSunken, brand: styles.surfaceBrand, noa: styles.surfaceNoa }[tone] || ''
  const classes = [styles.surface, toneClass, (interactive || onClick || to) && styles.surfaceInteractive, className].filter(Boolean).join(' ')
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} {...rest}>
        {children}
      </button>
    )
  }
  const Tag = as || 'div'
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}

export function ListItem({ icon, title, meta, trailing, to, onClick, children, chevron = true, leading, ...rest }) {
  const content = (
    <>
      {leading ? leading : icon ? (
        <span className={styles.listItemLeading}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <span className={styles.listItemBody}>
        <span className={styles.listItemTitle}>{title}</span>
        {meta ? <span className={styles.listItemMeta}>{meta}</span> : null}
        {children}
      </span>
      <span className={styles.listItemTrailing}>
        {trailing}
        {chevron && (to || onClick) ? <Icon name="chevronRight" size={18} /> : null}
      </span>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={styles.listItem} {...rest}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={styles.listItem} onClick={onClick} {...rest}>
        {content}
      </button>
    )
  }
  return (
    <div className={styles.listItem} {...rest}>
      {content}
    </div>
  )
}

export function EmptyState({ icon = 'info', title, text, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={28} />
      </span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      {text ? <p className={styles.emptyText}>{text}</p> : null}
      {action}
    </div>
  )
}

export function Skeleton({ height = 20, width = '100%', radius, style, count = 1 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.skeleton} style={{ display: 'block', height, width, borderRadius: radius, ...style }} aria-hidden="true" />
      ))}
    </>
  )
}

export function SectionTitle({ children, action, as = 'h2' }) {
  const Tag = as
  return (
    <Tag className={styles.sectionTitle}>
      <span>{children}</span>
      {action}
    </Tag>
  )
}

export function Wordmark({ size = 24, to, className }) {
  const t = useT()
  const classes = [styles.wordmark, className].filter(Boolean).join(' ')
  const style = { fontSize: size }
  if (to) {
    return (
      <Link to={to} className={classes} style={style} aria-label={t('common.nav.home')}>
        Memora
      </Link>
    )
  }
  return (
    <span className={classes} style={style}>
      Memora
    </span>
  )
}
