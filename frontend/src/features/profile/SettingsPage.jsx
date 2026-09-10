import { useEffect, useRef, useState } from 'react'
import styles from './profile.module.css'
import { Input, PageHeader, Segmented, Select, Skeleton, Stepper, Surface, Toggle, useToast } from '../../design-system/index.js'
import { useT, SUPPORTED_LOCALES } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useStudy } from '../../state/StudyContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Noronha', 'America/New_York', 'Europe/Lisbon', 'Europe/London', 'Asia/Tokyo']

export function SettingsPage() {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const study = useStudy()
  const [goal, setGoal] = useState(study.today?.goal ?? 20)
  const debounce = useRef(null)
  useDocumentTitle(t('profile.settings.title'))
  const user = session.user
  const notif = session.notifications

  useEffect(() => {
    if (study.today?.goal) setGoal(study.today.goal)
  }, [study.today?.goal])

  const save = async (patch) => {
    try {
      await session.updateSettings(patch)
      toast.show({ message: t('profile.settings.saved'), icon: 'check' })
      if ('dailyGoal' in patch || 'fatigueDetection' in patch) study.loadToday()
    } catch (err) {
      toast.show({ message: err.code === 'intensity_locked' ? t('profile.settings.intensityLocked') : err.message, tone: 'danger' })
    }
  }

  const changeGoal = (value) => {
    setGoal(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => save({ dailyGoal: value }), 600)
  }

  if (!user || !notif) return <Skeleton height={160} count={2} />
  const a11y = user.settings?.accessibility || {}

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.settings.title')} backTo="/app/perfil" />

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.settings.notifications')}</h2>
        <div>
          <p className={styles.rowTitle} style={{ marginBottom: 8 }}>
            {t('profile.settings.intensity')}
          </p>
          <Segmented
            label={t('profile.settings.intensity')}
            value={notif.intensity}
            onChange={(v) => save({ intensity: v })}
            options={['leve', 'padrao', 'intenso'].map((k) => ({ value: k, label: t(`profile.settings.intensities.${k}`), disabled: user.isMinor && k !== 'leve' }))}
          />
          <p className={styles.meta} style={{ marginTop: 8 }}>
            {user.isMinor ? t('profile.settings.intensityLocked') : t('profile.settings.intensityHelp')}
          </p>
        </div>
        <Input label={t('profile.settings.reminder')} type="time" value={notif.reminderTime} onChange={(e) => save({ reminderTime: e.target.value })} />
        <Toggle checked={notif.push} onChange={(v) => save({ push: v })} label={t('profile.settings.push')} help={t('profile.settings.limits')} />
        <p className={styles.meta}>{t('profile.settings.quiet')}</p>
      </Surface>

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.settings.goal')}</h2>
        <div className={styles.row}>
          <span className={styles.meta}>{t('profile.settings.goalUnit')}</span>
          <Stepper value={goal} min={5} max={200} step={5} onChange={changeGoal} label={t('profile.settings.goal')} />
        </div>
        <Toggle checked={study.today?.fatigue?.enabled !== false} onChange={(v) => save({ fatigueDetection: v })} label={t('profile.settings.fatigue')} help={t('profile.settings.fatigueHelp')} />
      </Surface>

      <Surface className={styles.stack}>
        <Select label={t('profile.settings.language')} value={user.locale} onChange={(e) => save({ locale: e.target.value })}>
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l.code} value={l.code} disabled={!l.available}>
              {l.label}
              {!l.available ? ` (${t('profile.settings.languageSoon')})` : ''}
            </option>
          ))}
        </Select>
        <Select label={t('profile.settings.timezone')} hint={t('profile.settings.timezoneHelp')} value={user.timezone} onChange={(e) => save({ timezone: e.target.value })}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Surface>

      <Surface className={styles.stack}>
        <h2 className={styles.sectionTitle}>{t('profile.settings.accessibility')}</h2>
        <Toggle checked={Boolean(a11y.reduceMotion)} onChange={(v) => save({ accessibility: { reduceMotion: v } })} label={t('profile.settings.reduceMotion')} />
        <Toggle checked={Boolean(a11y.largeText)} onChange={(v) => save({ accessibility: { largeText: v } })} label={t('profile.settings.largeText')} />
        <p className={styles.meta}>{t('profile.settings.keyboardNote')}</p>
      </Surface>
    </div>
  )
}
