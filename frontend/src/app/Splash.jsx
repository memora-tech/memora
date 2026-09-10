import { Wordmark } from '../design-system/index.js'

export function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--color-surface)' }} role="status" aria-live="polite">
      <Wordmark size={32} />
    </div>
  )
}
