import { useEffect, useRef, useState } from 'react'
import styles from './ds.module.css'
import { Icon } from './Icon.jsx'
import { fmtNumber } from '../lib/format.js'
import { useT } from '../i18n/index.js'

export function NeuronCounter({ value, size = 18, showLabel = false, className, highlight = false }) {
  const t = useT()
  const [display, setDisplay] = useState(value ?? 0)
  const [delta, setDelta] = useState(null)
  const [pulse, setPulse] = useState(false)
  const prev = useRef(value ?? 0)

  useEffect(() => {
    if (value === undefined || value === null) return undefined
    const diff = value - prev.current
    if (diff !== 0) {
      setDelta(diff)
      setPulse(true)
      const start = prev.current
      const startAt = performance.now()
      const duration = 600
      let raf
      const tick = (now) => {
        const p = Math.min(1, (now - startAt) / duration)
        setDisplay(Math.round(start + diff * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      const timer = setTimeout(() => {
        setDelta(null)
        setPulse(false)
      }, 1300)
      prev.current = value
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(timer)
      }
    }
    prev.current = value
    setDisplay(value)
    return undefined
  }, [value])

  return (
    <span className={[styles.neuron, pulse && styles.neuronPulse, className].filter(Boolean).join(' ')} aria-live="polite" aria-atomic="true" data-highlight={highlight || undefined}>
      <Icon name="neuron" size={size} />
      <span className="tabnum">{fmtNumber(display)}</span>
      {showLabel ? <span className={styles.muted}>{t('common.units.neurons')}</span> : <span className={styles.visuallyHidden}>{t('common.units.neurons')}</span>}
      {delta !== null ? (
        <span className={styles.neuronFloat} aria-hidden="true">
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ) : null}
    </span>
  )
}
