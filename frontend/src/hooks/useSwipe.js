import { useCallback, useRef, useState } from 'react'

const TAP_DRIFT = 14
const VERTICAL_GUARD = 80

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 90, onTap, onLongPress, longPressDelay = 450 } = {}) {
  const origin = useRef(null)
  const timer = useRef(null)
  const longFired = useRef(false)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return
      origin.current = { x: e.clientX, y: e.clientY, t: Date.now() }
      longFired.current = false
      setDragging(true)
      e.currentTarget.setPointerCapture?.(e.pointerId)
      clearTimer()
      if (onLongPress) {
        timer.current = setTimeout(() => {
          longFired.current = true
          if (navigator.vibrate) navigator.vibrate(12)
          onLongPress(e)
        }, longPressDelay)
      }
    },
    [onLongPress, longPressDelay]
  )

  const onPointerMove = useCallback((e) => {
    if (!origin.current) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    if (Math.abs(dx) > TAP_DRIFT || Math.abs(dy) > TAP_DRIFT) clearTimer()
    if (Math.abs(dx) > Math.abs(dy)) setOffset(dx)
  }, [])

  const finish = useCallback(
    (e) => {
      clearTimer()
      if (!origin.current) return
      const dx = e.clientX - origin.current.x
      const dy = Math.abs(e.clientY - origin.current.y)
      origin.current = null
      setDragging(false)
      setOffset(0)
      if (longFired.current) return
      if (dx > threshold && dy < VERTICAL_GUARD) onSwipeRight?.(e)
      else if (dx < -threshold && dy < VERTICAL_GUARD) onSwipeLeft?.(e)
      else if (Math.abs(dx) <= TAP_DRIFT && dy <= TAP_DRIFT) onTap?.(e)
    },
    [onSwipeLeft, onSwipeRight, onTap, threshold]
  )

  const onPointerCancel = useCallback(() => {
    clearTimer()
    origin.current = null
    setDragging(false)
    setOffset(0)
  }, [])

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel, onContextMenu: (e) => e.preventDefault() }
  }
}
