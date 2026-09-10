import { useCallback, useRef } from 'react'

export function useLongPress({ onLongPress, onTap, delay = 450, moveTolerance = 16 } = {}) {
  const timer = useRef(null)
  const start = useRef(null)
  const fired = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      clear()
      timer.current = setTimeout(() => {
        fired.current = true
        if (navigator.vibrate) navigator.vibrate(12)
        onLongPress?.(e)
      }, delay)
    },
    [clear, delay, onLongPress]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!start.current) return
      const dx = Math.abs(e.clientX - start.current.x)
      const dy = Math.abs(e.clientY - start.current.y)
      if (dx > moveTolerance || dy > moveTolerance) clear()
    },
    [clear, moveTolerance]
  )

  const onPointerUp = useCallback(
    (e) => {
      clear()
      const began = start.current !== null
      start.current = null
      if (fired.current || !began) return
      const rect = e.currentTarget.getBoundingClientRect?.()
      const measurable = rect && rect.width > 0 && rect.height > 0
      const inside = !measurable || (e.clientX >= rect.left - 8 && e.clientX <= rect.right + 8 && e.clientY >= rect.top - 8 && e.clientY <= rect.bottom + 8)
      if (inside) onTap?.(e)
    },
    [clear, onTap]
  )

  const onPointerCancel = useCallback(() => {
    clear()
    start.current = null
  }, [clear])

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onTap?.(e)
      }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault()
        onLongPress?.(e)
      }
    },
    [onLongPress, onTap]
  )

  const onContextMenu = useCallback((e) => {
    e.preventDefault()
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown, onContextMenu }
}
