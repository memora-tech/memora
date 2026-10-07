import styles from './screen.module.css'

export function TargetRing({ value, max, size = 112, center, caption, tone = 'brand' }) {
  const stroke = Math.max(6, Math.round(size / 14))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const mid = size / 2
  return (
    <span className={styles.target} data-tone={tone} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={mid} cy={mid} r={r * 0.72} className={styles.targetRingB} />
        <circle cx={mid} cy={mid} r={r * 0.46} className={styles.targetRingA} />
        <circle cx={mid} cy={mid} r={r * 0.2} className={styles.targetBull} />
        <circle cx={mid} cy={mid} r={r} className={styles.targetTrack} strokeWidth={stroke} />
        <circle cx={mid} cy={mid} r={r} className={styles.targetArc} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${mid} ${mid})`} />
      </svg>
      {center !== undefined ? (
        <span className={styles.targetCenter}>
          <span className={styles.targetValue} style={{ fontSize: Math.round(size / 4.2) }}>
            {center}
          </span>
          {caption ? <span className={styles.targetCaption}>{caption}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
