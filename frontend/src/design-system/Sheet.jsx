import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ds.module.css'
import { Button } from './Button.jsx'
import { useT } from '../i18n/index.js'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const CLOSE_DISTANCE = 96

export function Sheet({ open, onClose, title, children, footer, role = 'dialog', describedBy, closeLabel, hideClose = false }) {
  const t = useT()
  const ref = useRef(null)
  const restoreRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const dragStart = useRef(null)
  const [dragY, setDragY] = useState(0)
  onCloseRef.current = onClose
  const closeText = closeLabel || t('common.actions.close')

  useEffect(() => {
    if (!open) return undefined
    setDragY(0)
    restoreRef.current = document.activeElement
    const node = ref.current
    const first = node?.querySelector(FOCUSABLE)
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll(FOCUSABLE))
        if (!items.length) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          firstItem.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  const onGripDown = useCallback((e) => {
    dragStart.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [])

  const onGripMove = useCallback((e) => {
    if (dragStart.current === null) return
    setDragY(Math.max(0, e.clientY - dragStart.current))
  }, [])

  const onGripUp = useCallback(() => {
    const travelled = dragY
    dragStart.current = null
    setDragY(0)
    if (travelled > CLOSE_DISTANCE) onCloseRef.current?.()
  }, [dragY])

  if (!open) return null

  const dragging = dragStart.current !== null

  return createPortal(
    <div className={styles.sheetBackdrop} onClick={(e) => e.target === e.currentTarget && onClose?.()} style={dragY ? { background: `rgba(7, 59, 92, ${Math.max(0.12, 0.35 - dragY / 600)})` } : undefined}>
      <div
        ref={ref}
        className={[styles.sheet, dragging && styles.sheetDragging].filter(Boolean).join(' ')}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
        aria-describedby={describedBy}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <button type="button" className={styles.sheetGrip} aria-label={t('common.actions.dragToClose')} onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} onClick={() => !dragY && onClose?.()}>
          <span className={styles.sheetHandle} />
        </button>
        {(title || !hideClose) && (
          <div className={styles.sheetHeader}>
            {title ? (
              <h2 id="sheet-title" className={styles.sheetTitle}>
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideClose && <Button variant="text" icon="x" label={closeText} onClick={onClose} />}
          </div>
        )}
        <div className={styles.sheetBody}>{children}</div>
        {footer ? <div className={styles.sheetFooter}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel, danger = false, loading = false }) {
  const t = useT()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      role="alertdialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel || t('common.actions.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel || t('common.actions.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Sheet>
  )
}
