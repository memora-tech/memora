import { useEffect, useState } from 'react'
import styles from './study.module.css'
import { Button, ChipButton, Sheet, Stepper, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { fmtDate } from '../../lib/format.js'

const PRESETS = [1, 3, 7, 14]

export function PauseSheet({ open, onClose }) {
  const t = useT()
  const study = useStudy()
  const toast = useToast()
  const [days, setDays] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDays(3)
  }, [open])

  const pause = async (value = days) => {
    setSaving(true)
    try {
      const s = await study.pause(value)
      toast.show({ message: t('study.goal.paused', { date: fmtDate(s.pausedUntil) }), icon: 'pause', action: { label: t('common.actions.undo'), onClick: () => study.resume().catch(() => {}) }, duration: 6000 })
      onClose()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('study.goal.pauseTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={() => pause(days)} loading={saving} icon="pause">
            {t('study.goal.pauseConfirm')}
          </Button>
        </>
      }
    >
      <p className={styles.objectiveMeta}>{t('study.goal.pausePresetHint')}</p>
      <div className={styles.dayChips} role="group" aria-label={t('study.goal.pauseTitle')}>
        {PRESETS.map((d) => (
          <ChipButton key={d} pressed={days === d} onClick={() => pause(d)} disabled={saving}>
            {t('study.goal.pauseDay', { count: d })}
          </ChipButton>
        ))}
      </div>
      <div className={styles.sheetRow}>
        <span>{t('study.goal.pauseDay', { count: days })}</span>
        <Stepper value={days} min={1} max={30} onChange={setDays} label={t('study.goal.pauseTitle')} />
      </div>
      <p className={styles.objectiveMeta}>{t('study.goal.pauseNote')}</p>
    </Sheet>
  )
}
