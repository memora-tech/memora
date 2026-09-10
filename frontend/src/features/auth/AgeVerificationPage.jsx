import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './auth.module.css'
import { Badge, Banner, Button, Input, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { daysUntil } from '../../lib/format.js'

function ageOf(birthDate) {
  if (!birthDate) return null
  return Math.floor(-daysUntil(birthDate) / 365.25)
}

export function AgeVerificationPage() {
  const t = useT()
  const navigate = useNavigate()
  const session = useSession()
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [guardian, setGuardian] = useState({ name: '', email: '', phone: '' })
  useDocumentTitle(t('auth.age.title'))
  const user = session.user
  const age = ageOf(user?.birthDate)
  const minor = age !== null && age < 16
  const under13 = age !== null && age < 13
  const steps = t('auth.age.steps')

  const run = async () => {
    setState('processing')
    try {
      const data = await session.verifyAge(minor ? { guardian } : {})
      setResult(data)
      setState(data.status === 'aprovado' ? 'done' : 'guardian')
    } catch {
      setState('idle')
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
          <span />
        </div>
      </div>
      <div>
        <h2 className={styles.title}>{t('auth.age.title')}</h2>
        <p className={styles.subtitle}>{t('auth.age.subtitle')}</p>
      </div>
      <div className={styles.steps}>
        {Array.isArray(steps)
          ? steps.map((s, i) => (
              <div key={s} className={styles.step}>
                <span className={styles.stepDot}>{i + 1}</span>
                <span>{s}</span>
              </div>
            ))
          : null}
      </div>
      <p className={styles.meta}>{t('auth.age.retention')}</p>

      {minor ? (
        <Banner tone="brand" icon="shield">
          <strong>{t('auth.age.guardianTitle')}</strong> {t('auth.age.guardianText')}
          {under13 ? ` ${t('auth.age.under13')}` : ''}
        </Banner>
      ) : null}
      {minor && state !== 'done' ? (
        <div className={styles.form}>
          <Input label={t('auth.age.guardianName')} value={guardian.name} onChange={(e) => setGuardian({ ...guardian, name: e.target.value })} autoComplete="off" />
          <Input label={t('auth.age.guardianEmail')} type="email" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
          <Input label={t('auth.age.guardianPhone')} type="tel" value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} />
        </div>
      ) : null}

      {state === 'done' ? (
        <Banner tone="success" icon="check">
          <strong>{t('auth.age.done')}</strong> {t('auth.age.method', { method: result?.ageVerification?.method })}
          {result?.isMinor ? ` ${t('auth.age.minorDone', { name: guardian.name })}` : ''}
        </Banner>
      ) : null}

      <div className={styles.footerActions}>
        <Button variant="text" onClick={() => navigate('/onboarding')}>
          {t('auth.age.skip')}
        </Button>
        {state === 'done' ? (
          <Button onClick={() => navigate('/onboarding')}>{t('auth.age.next')}</Button>
        ) : (
          <Button icon="idCard" loading={state === 'processing'} disabled={minor && !guardian.name.trim()} onClick={run}>
            {minor ? t('auth.age.guardianSubmit') : t('auth.age.start')}
          </Button>
        )}
      </div>
      {state === 'processing' ? (
        <p className={styles.meta} role="status">
          {t('auth.age.processing')}
        </p>
      ) : null}
      {user?.ageVerification?.status === 'aprovado' && state === 'idle' ? <Badge tone="success" icon="check">{t('auth.age.done')}</Badge> : null}
    </>
  )
}
