import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ds.module.css'
import { Icon } from './Icon.jsx'

const ToastContext = createContext({ show: () => {}, dismiss: () => {} })

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    ({ message, tone = 'neutral', icon, action, duration }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const ms = duration ?? (action ? 8000 : 3600)
      setToasts((list) => [...list.slice(-1), { id, message, tone, icon, action }])
      timers.current.set(id, setTimeout(() => dismiss(id), ms))
      return id
    },
    [dismiss]
  )

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className={styles.toastRegion} aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={[styles.toast, toast.tone === 'reward' && styles.toastReward, toast.tone === 'danger' && styles.toastDanger].filter(Boolean).join(' ')} role="status">
              {toast.icon ? <Icon name={toast.icon} size={18} /> : null}
              <span className={styles.toastText}>{toast.message}</span>
              {toast.action ? (
                <button
                  type="button"
                  className={styles.toastAction}
                  onClick={() => {
                    toast.action.onClick?.()
                    dismiss(toast.id)
                  }}
                >
                  {toast.action.label}
                </button>
              ) : null}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
