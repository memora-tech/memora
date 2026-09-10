import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './ds.module.css'
import { Icon } from './Icon.jsx'

const VARIANTS = { primary: styles.primary, ghost: styles.ghost, soft: styles.soft, text: styles.text, danger: styles.danger, reward: styles.reward }

export const Button = forwardRef(function Button(
  { variant = 'primary', size, block, icon, iconRight, children, loading, className, to, href, type = 'button', label, ...rest },
  ref
) {
  const classes = [styles.btn, VARIANTS[variant] || styles.primary, size === 'large' && styles.large, size === 'small' && styles.small, block && styles.block, !children && icon && styles.iconOnly, className]
    .filter(Boolean)
    .join(' ')
  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'small' ? 18 : 20} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
    </>
  )
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-label={label} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} aria-label={label} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} aria-label={label} aria-busy={loading || undefined} disabled={rest.disabled || loading} {...rest}>
      {content}
    </button>
  )
})
