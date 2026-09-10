import { useEffect, useRef, useState } from 'react'
import styles from './study.module.css'
import { Button, Chip, Sheet, Stepper, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { studentApi } from '../../lib/api.js'
import { daysUntil, fmtDate } from '../../lib/format.js'

export function GoalMenuSheet({ open, onClose, onPause, onAddObjective }) {
  const t = useT()
  const study = useStudy()
  const toast = useToast()
  const today = study.today
  const [goal, setGoal] = useState(today?.goal ?? 20)
  const [objectives, setObjectives] = useState([])
  const debounce = useRef(null)

  useEffect(() => {
    if (open) {
      setGoal(today?.goal ?? 20)
      studentApi
        .get('/objectives')
        .then((d) => setObjectives(d.objectives))
        .catch(() => setObjectives([]))
    }
  }, [open, today?.goal])

  const changeGoal = (value) => {
    setGoal(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      study
        .setGoal(value)
        .then(() => toast.show({ message: t('study.goal.goalSaved', { count: value }), icon: 'check' }))
        .catch((err) => toast.show({ message: err.message, tone: 'danger' }))
    }, 600)
  }

  const reschedule = async () => {
    try {
      const s = await study.skipToday()
      toast.show({ message: t('study.home.skippedToast', { used: s.reschedules.used, limit: s.reschedules.limit }), icon: 'calendar', action: { label: t('common.actions.undo'), onClick: () => study.undoSkip().catch(() => {}) }, duration: 5000 })
      onClose()
    } catch (err) {
      toast.show({ message: err.code === 'reschedule_limit' ? t('study.home.skipLimit') : err.message, tone: 'danger' })
    }
  }

  const prioritize = async (objective) => {
    try {
      await studentApi.patch(`/objectives/${objective.id}`, { priority: true })
      toast.show({ message: t('study.goal.prioritized', { name: objective.name }), icon: 'check' })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const upcoming = objectives.filter((o) => !o.past)
  const tieDate = upcoming.length > 1 && upcoming[0].date === upcoming[1].date ? upcoming[0].date : null
  const skippedToday = today?.status === 'reagendado'
  const limitReached = (today?.reschedules?.used ?? 0) >= (today?.reschedules?.limit ?? 3)

  return (
    <Sheet open={open} onClose={onClose} title={t('study.goal.title')}>
      <div className={styles.sheetList}>
        <div className={styles.sheetRow}>
          <div>
            <div className={styles.objectiveName}>{t('study.goal.reschedule')}</div>
            <div className={styles.objectiveMeta}>{skippedToday ? t('study.goal.rescheduleDone') : limitReached ? t('study.goal.rescheduleLimit') : t('study.goal.rescheduleMeta', { used: today?.reschedules?.used ?? 0, limit: today?.reschedules?.limit ?? 3 })}</div>
          </div>
          <Button variant="soft" size="small" onClick={reschedule} disabled={skippedToday || limitReached || today?.status === 'pausado'}>
            {t('study.home.notToday')}
          </Button>
        </div>
        <div className={styles.sheetRow}>
          <div>
            <div className={styles.objectiveName}>{t('study.goal.pauseTitle')}</div>
            <div className={styles.objectiveMeta}>{today?.pausedUntil ? t('study.goal.paused', { date: fmtDate(today.pausedUntil) }) : t('study.goal.pauseShort')}</div>
          </div>
          <Button variant="ghost" size="small" icon="pause" onClick={onPause}>
            {t('study.goal.pauseConfirm')}
          </Button>
        </div>
        <div className={styles.sheetRow}>
          <div>
            <div className={styles.objectiveName}>{t('study.goal.adjust')}</div>
            <div className={styles.objectiveMeta}>{t('study.goal.suggested', { count: today?.goalSuggested ?? goal })}</div>
          </div>
          <Stepper value={goal} min={5} max={200} step={5} onChange={changeGoal} label={t('study.goal.adjust')} />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--size-body)', marginBottom: 8 }}>{t('study.goal.objectives')}</h3>
        {tieDate ? <p className={styles.objectiveMeta}>{t('study.goal.tie')}</p> : null}
        {upcoming.map((o) => {
          const days = daysUntil(o.date)
          return (
            <div key={o.id} className={styles.objectiveRow}>
              <div>
                <div className={styles.objectiveName}>{o.name}</div>
                <div className={styles.objectiveMeta}>
                  {days === 0 ? t('study.goal.today') : days < 0 ? t('study.goal.past') : t('study.goal.daysLeft', { count: days })} · {fmtDate(o.date)}
                  {o.subjects?.length ? ` · ${o.subjects.join(', ')}` : ''}
                </div>
              </div>
              {tieDate === o.date ? (
                <Button size="small" variant={o.priority ? 'primary' : 'ghost'} onClick={() => prioritize(o)}>
                  {o.priority ? t('study.goal.prioritizedShort') : t('common.actions.confirm')}
                </Button>
              ) : (
                <Chip tone="neutral">{t('common.units.days', { count: Math.max(0, days) })}</Chip>
              )}
            </div>
          )
        })}
        <div className={styles.stateActions} style={{ marginTop: 12 }}>
          <Button variant="soft" size="small" icon="plus" onClick={onAddObjective}>
            {t('study.goal.addObjective')}
          </Button>
          <Button variant="text" size="small" to="/app/perfil/objetivos" onClick={onClose}>
            {t('study.goal.manage')}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
