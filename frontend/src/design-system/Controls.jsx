import { useId } from 'react'
import styles from './ds.module.css'
import { Icon } from './Icon.jsx'
import { Button } from './Button.jsx'
import { useT } from '../i18n/index.js'

export function Toggle({ checked, onChange, label, help, disabled, lockedReason }) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-labelledby={`${id}-label`}
      aria-describedby={help || lockedReason ? `${id}-help` : undefined}
      className={styles.toggle}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <span className={styles.toggleText}>
        <span id={`${id}-label`} className={styles.toggleLabel}>
          {label}
        </span>
        {(help || lockedReason) && (
          <span id={`${id}-help`} className={styles.toggleHelp}>
            {lockedReason || help}
          </span>
        )}
      </span>
      <span className={styles.toggleTrack} aria-hidden="true" />
    </button>
  )
}

export function Segmented({ options, value, onChange, label, name }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented} id={name || id}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value ? 'true' : 'false'}
          className={styles.segment}
          disabled={opt.disabled}
          title={opt.title}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.icon ? <Icon name={opt.icon} size={16} /> : null}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ children, tone = 'brand', icon, className, ...rest }) {
  const toneClass = { brand: '', neutral: styles.chipNeutral, reward: styles.chipReward, success: styles.chipSuccess, warning: styles.chipWarning, danger: styles.chipDanger }[tone] || ''
  return (
    <span className={[styles.chip, toneClass, className].filter(Boolean).join(' ')} {...rest}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  )
}

export function ChipButton({ children, pressed, onClick, icon, role, ...rest }) {
  const stateProps = role ? { role, 'aria-checked': pressed ? 'true' : 'false' } : { 'aria-pressed': pressed ? 'true' : 'false' }
  return (
    <button type="button" className={[styles.chip, styles.chipButton].join(' ')} {...stateProps} onClick={onClick} {...rest}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral', icon }) {
  const toneClass = { neutral: '', brand: styles.badgeBrand, success: styles.badgeSuccess, warning: styles.badgeWarning, danger: styles.badgeDanger, reward: styles.badgeReward, noa: styles.badgeNoa }[tone] || ''
  return (
    <span className={[styles.badge, toneClass].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

export function ProgressBar({ value, max = 100, tone, thin, label }) {
  const pctValue = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const toneClass = { reward: styles.progressReward, warning: styles.progressWarning, danger: styles.progressDanger }[tone] || ''
  return (
    <div className={[styles.progress, thin && styles.progressThin, toneClass].filter(Boolean).join(' ')} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={styles.progressFill} style={{ width: `${pctValue}%` }} />
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, unit }) {
  const t = useT()
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <Button variant="ghost" icon="minus" size="small" label={`${t('common.actions.decrease')} ${label || ''}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
      <span className={`${styles.stepperValue} tabnum`} aria-live="polite">
        {value}
        {unit ? <span className={styles.muted}> {unit}</span> : null}
      </span>
      <Button variant="ghost" icon="plus" size="small" label={`${t('common.actions.increase')} ${label || ''}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
    </div>
  )
}

export function Banner({ tone = 'brand', icon, children, action, className }) {
  const toneClass = { brand: '', warning: styles.bannerWarning, danger: styles.bannerDanger, success: styles.bannerSuccess, neutral: styles.bannerNeutral }[tone] || ''
  return (
    <div className={[styles.banner, toneClass, className].filter(Boolean).join(' ')} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon ? <Icon name={icon} size={20} className={styles.bannerIcon} /> : <span />}
      <div className={styles.bannerBody}>{children}</div>
      {action ? <div className={styles.bannerAction}>{action}</div> : null}
    </div>
  )
}

export function Avatar({ name, large }) {
  const letters = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className={[styles.avatar, large && styles.avatarLarge].filter(Boolean).join(' ')} aria-hidden="true">
      {letters}
    </span>
  )
}

export function Stat({ value, label, className }) {
  return (
    <div className={[styles.stat, className].filter(Boolean).join(' ')}>
      <span className={`${styles.statValue} tabnum`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value ? 'true' : 'false'} className={styles.tab} onClick={() => onChange(tab.value)}>
          {tab.icon ? <Icon name={tab.icon} size={16} /> : null}
          {tab.label}
          {tab.count !== undefined ? <Badge tone={value === tab.value ? 'brand' : 'neutral'}>{tab.count}</Badge> : null}
        </button>
      ))}
    </div>
  )
}
