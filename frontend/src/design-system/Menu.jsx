import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ds.module.css'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'
import { useT } from '../i18n/index.js'

export const MENU_MAX_ITEMS = 6

export function OverflowMenu({ items, label: givenLabel, align = 'right' }) {
  const t = useT()
  const label = givenLabel || t('common.actions.more')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const visible = items.filter(Boolean).slice(0, MENU_MAX_ITEMS)

  useEffect(() => {
    if (!open) return undefined
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const width = 260
      const left = align === 'right' ? Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) : Math.max(8, rect.left)
      const top = rect.bottom + 6 + window.scrollY
      setPos({ top, left })
    }
    const first = menuRef.current?.querySelector('button')
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const buttons = Array.from(menuRef.current?.querySelectorAll('button') || [])
        const idx = buttons.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length
        buttons[next]?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, align])

  return (
    <>
      <Button ref={btnRef} variant="ghost" icon="more" label={label} aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen((v) => !v)} />
      {open &&
        createPortal(
          <div className={styles.menuBackdrop} onClick={() => setOpen(false)}>
            <div ref={menuRef} className={styles.menu} role="menu" aria-label={label} style={{ top: pos.top, left: pos.left, position: 'absolute' }} onClick={(e) => e.stopPropagation()}>
              {visible.map((item) => (
                <button
                  key={item.key || item.label}
                  type="button"
                  role="menuitem"
                  className={[styles.menuItem, item.danger && styles.menuItemDanger, item.active && styles.menuItemActive].filter(Boolean).join(' ')}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect?.()
                  }}
                >
                  {item.icon ? <Icon name={item.icon} size={18} /> : null}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.active ? <Icon name="check" size={16} /> : null}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
