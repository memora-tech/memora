import { useEffect } from 'react'

const isTyping = (target) => {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
}

export function useKeyboardShortcuts(map, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined
    const handler = (e) => {
      if (isTyping(e.target)) return
      const key = e.key === ' ' ? 'Space' : e.key
      const fn = map[key]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [map, enabled])
}
