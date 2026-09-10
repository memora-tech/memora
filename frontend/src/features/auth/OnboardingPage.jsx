import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './auth.module.css'
import { Banner, Button, ChipButton, Input, Segmented, Toggle, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

const TIMES = [5, 10, 20, 30]

export function OnboardingPage() {
  const t = useT()
  const navigate = useNavigate()
  const session = useSession()
  const [context, setContext] = useState('')
  const [subjects, setSubjects] = useState([])
  const [minutes, setMinutes] = useState(10)
  const [hasExam, setHasExam] = useState(false)
  const [exam, setExam] = useState({ name: '', date: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('auth.onboarding.title'))
  const contexts = t('auth.onboarding.contexts')
  const options = t('auth.onboarding.subjectOptions')
  const goal = Math.max(5, Math.round((minutes * 60) / 20 / 5) * 5)

  const submit = async () => {
    if (!context) {
      setError(t('auth.onboarding.errors.context'))
      return
    }
    setBusy(true)
    try {
      await session.completeOnboarding({ context, subjects, minutesPerDay: minutes, objective: hasExam && exam.name && exam.date ? exam : null })
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles.brandRow}>
        <Wordmark size={24} />
        <div className={styles.progress} aria-hidden="true" style={{ width: 120 }}>
          <span data-done="true" />
          <span data-done="true" />
          <span data-done="true" />
          <span data-done="true" />
        </div>
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.onboarding.title')}</h2>
        <p className={styles.subtitle}>{t('auth.onboarding.subtitle')}</p>
      </div>
      {error ? (
        <Banner tone="danger" icon="alert">
          {error}
        </Banner>
      ) : null}
      <div className={styles.form}>
        <div>
          <p style={{ fontWeight: 500, marginBottom: 8 }} id="ctx-label">
            {t('auth.onboarding.context')}
          </p>
          <div className={styles.chips} role="radiogroup" aria-labelledby="ctx-label">
            {Array.isArray(contexts)
              ? contexts.map((c) => (
                  <ChipButton key={c} pressed={context === c} onClick={() => setContext(c)} role="radio">
                    {c}
                  </ChipButton>
                ))
              : null}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 500, marginBottom: 8 }} id="subj-label">
            {t('auth.onboarding.subjects')}
          </p>
          <div className={styles.chips} role="group" aria-labelledby="subj-label">
            {Array.isArray(options)
              ? options.map((s) => (
                  <ChipButton key={s} pressed={subjects.includes(s)} onClick={() => setSubjects((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))}>
                    {s}
                  </ChipButton>
                ))
              : null}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 500, marginBottom: 8 }}>{t('auth.onboarding.time')}</p>
          <Segmented label={t('auth.onboarding.time')} value={minutes} onChange={setMinutes} options={TIMES.map((m) => ({ value: m, label: t('auth.onboarding.minutes', { count: m }) }))} />
          <p className={styles.meta} style={{ marginTop: 8 }}>
            {t('auth.onboarding.suggestedGoal', { count: goal, minutes })}
          </p>
        </div>
        <Toggle checked={hasExam} onChange={setHasExam} label={t('auth.onboarding.exam')} />
        {hasExam ? (
          <>
            <Input label={t('auth.onboarding.examName')} value={exam.name} onChange={(e) => setExam({ ...exam, name: e.target.value })} />
            <Input label={t('auth.onboarding.examDate')} type="date" value={exam.date} onChange={(e) => setExam({ ...exam, date: e.target.value })} />
          </>
        ) : null}
      </div>
      <div className={styles.footerActions}>
        <Button variant="text" onClick={() => navigate('/app')}>
          {t('auth.onboarding.skip')}
        </Button>
        <Button icon="play" loading={busy} onClick={submit}>
          {t('auth.onboarding.submit')}
        </Button>
      </div>
    </>
  )
}
