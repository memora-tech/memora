import { useId } from 'react'
import styles from './ds.module.css'
import { Icon } from './Icon.jsx'
import { useT } from '../i18n/index.js'

export function Field({ label, hint, error, children, id: givenId, optional }) {
  const t = useT()
  const autoId = useId()
  const id = givenId || autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={styles.field}>
      {label ? (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label} {optional ? <span className={styles.fieldHint}>{t('common.field.optional')}</span> : null}
        </label>
      ) : null}
      {typeof children === 'function' ? children({ id, 'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? 'true' : undefined }) : children}
      {hint ? (
        <p id={hintId} className={styles.fieldHint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.fieldError} role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ label, hint, error, optional, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={rest.id}>
      {(a11y) => <input className={[styles.fieldControl, className].filter(Boolean).join(' ')} {...a11y} {...rest} />}
    </Field>
  )
}

export function Textarea({ label, hint, error, optional, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={rest.id}>
      {(a11y) => <textarea className={[styles.fieldControl, className].filter(Boolean).join(' ')} {...a11y} {...rest} />}
    </Field>
  )
}

export function Select({ label, hint, error, optional, className, children, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} id={rest.id}>
      {(a11y) => (
        <select className={[styles.fieldControl, className].filter(Boolean).join(' ')} {...a11y} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}
