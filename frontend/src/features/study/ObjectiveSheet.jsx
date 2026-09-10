import { useEffect, useState } from 'react'
import styles from './study.module.css'
import { Button, Input, Sheet, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { studentApi } from '../../lib/api.js'

export function ObjectiveSheet({ open, onClose, onSaved }) {
  const t = useT()
  const study = useStudy()
  const toast = useToast()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [tie, setTie] = useState(null)

  useEffect(() => {
    if (open) {
      setName('')
      setDate('')
      setErrors({})
      setTie(null)
    }
  }, [open])

  const save = async () => {
    const next = {}
    if (!name.trim()) next.name = t('study.objective.errorName')
    if (!date) next.date = t('study.objective.errorDate')
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const data = await studentApi.post('/objectives', { name: name.trim(), date })
      const subjects = data.objective.subjects
      toast.show({ message: subjects.length ? t('study.objective.inferred', { subjects: subjects.join(', ') }) : t('study.objective.saved'), icon: 'check', duration: 5000 })
      await study.loadToday()
      onSaved?.(data.objective)
      if (data.tie) {
        setTie(data.tie)
      } else {
        onClose()
      }
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const prioritize = async (id) => {
    try {
      await studentApi.patch(`/objectives/${id}`, { priority: true })
      const chosen = tie.find((x) => x.id === id)
      toast.show({ message: t('study.goal.prioritized', { name: chosen?.name || '' }), icon: 'check' })
      onClose()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tie ? t('study.objective.tieTitle') : t('study.objective.title')}
      footer={
        tie ? null : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={save} loading={saving}>
              {t('study.objective.save')}
            </Button>
          </>
        )
      }
    >
      {tie ? (
        <div className={styles.sheetList}>
          <p>{t('study.objective.tieText')}</p>
          {tie.map((o) => (
            <Button key={o.id} variant="ghost" block onClick={() => prioritize(o.id)}>
              {o.name}
            </Button>
          ))}
        </div>
      ) : (
        <>
          <Input label={t('study.objective.name')} placeholder={t('study.objective.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="off" />
          <Input label={t('study.objective.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} min={new Date().toISOString().slice(0, 10)} />
          <p className={styles.objectiveMeta}>{t('study.objective.inferredNone')}</p>
        </>
      )}
    </Sheet>
  )
}
