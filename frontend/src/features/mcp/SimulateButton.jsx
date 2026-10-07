import { useState } from 'react'
import { Button, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { simulateMcpArrival } from './arrivals.js'

export function SimulateButton({ size, variant = 'soft', block, onDone, kind = 'flashcards' }) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const post = kind === 'noticia'
  const run = async () => {
    setBusy(true)
    try {
      const res = await simulateMcpArrival(kind)
      toast.show({ message: t(post ? 'mcp.arrival.simulatedPost' : 'mcp.arrival.simulated', { name: res.result.titulo }), icon: 'plug', duration: 6000 })
      onDone?.(res)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button size={size} variant={variant} block={block} icon={post ? 'news' : 'send'} onClick={run} loading={busy} title={t('mcp.arrival.simulateHint')}>
      {busy ? t('mcp.arrival.simulating') : t(post ? 'mcp.arrival.simulatePost' : 'mcp.arrival.simulate')}
    </Button>
  )
}
