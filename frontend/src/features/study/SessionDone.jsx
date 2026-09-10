import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './study.module.css'
import { Banner, Button, Icon, Stat, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useSession } from '../../state/SessionContext.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'

export function SessionDone() {
  const t = useT()
  const study = useStudy()
  const session = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const summary = study.lastSummary
  const [outcomeDone, setOutcomeDone] = useState(null)
  useDocumentTitle(t('study.done.title'))

  useEffect(() => {
    if (!summary) navigate('/app', { replace: true })
  }, [summary, navigate])

  if (!summary) return null

  const earned = summary.neuronsEarnedToday ?? 0
  const goalLeft = Math.max(0, (summary.goal ?? 0) - (summary.cardsReviewed ?? 0))

  const sendOutcome = async (outcome) => {
    try {
      const data = await studentApi.post(`/objectives/${summary.pendingOutcome.id}/outcome`, { outcome })
      setOutcomeDone(data)
      if (data.reward) window.dispatchEvent(new CustomEvent('memora:reward', { detail: { rewards: [data.reward], balance: data.balance } }))
      else toast.show({ message: t('study.done.outcomeSaved'), icon: 'check' })
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const continueStudy = () => {
    if (summary.remainingDue > 0 && study.start({ mode: 'today' })) {
      navigate('/app/estudar')
      return
    }
    toast.show({ message: t('study.done.nothingLeft') })
    navigate('/app/comunidade')
  }

  return (
    <div className={styles.done}>
      <div className={styles.doneHero}>
        <div className={styles.doneNeuron} aria-hidden="true">
          <Icon name="neuron" size={40} />
        </div>
        {session.canEarn ? <p className={styles.doneAmount}>{t('study.done.neuronsToday', { count: earned })}</p> : <p className={styles.stateText}>{t('study.done.noNeurons')}</p>}
        <h1 className={styles.doneTitle}>{t('study.done.title')}</h1>
      </div>

      <Surface>
        <div className={styles.doneStats}>
          <Stat className={styles.doneStat} value={summary.streak ?? 0} label={t('study.done.labels.streak')} />
          <Stat className={styles.doneStat} value={summary.cardsReviewed ?? 0} label={t('study.done.labels.cards')} />
          <Stat className={styles.doneStat} value={summary.accuracy !== null && summary.accuracy !== undefined ? `${summary.accuracy}%` : '—'} label={t('study.done.labels.accuracy')} />
        </div>
        <p className={styles.planMeta} style={{ marginTop: 12 }}>
          {summary.goalHit ? t('study.done.goalHit') : t('study.done.goalLeft', { count: goalLeft })}
        </p>
      </Surface>

      {summary.offline || summary.local?.offline ? (
        <Banner tone="neutral" icon="wifiOff">
          {t('study.done.offlineNote')}
        </Banner>
      ) : null}
      {summary.reduced || summary.local?.reduced ? (
        <Banner tone="warning" icon="clock">
          {t('study.done.reducedNote')}
        </Banner>
      ) : null}

      {summary.pendingOutcome && !outcomeDone ? (
        <Surface tone="brand" className={styles.stateCard} style={{ textAlign: 'left' }}>
          <h2 className={styles.stateTitle}>{t('study.done.howWasTitle', { name: summary.pendingOutcome.name })}</h2>
          <p className={styles.stateText}>{t('study.done.howWasHint')}</p>
          <div className={styles.outcomeGrid}>
            {['aprovado', 'reprovado', 'aguardando', 'nao_fiz'].map((o) => (
              <Button key={o} variant={o === 'aprovado' ? 'primary' : 'ghost'} onClick={() => sendOutcome(o)}>
                {t(`study.done.outcomes.${o}`)}
              </Button>
            ))}
          </div>
        </Surface>
      ) : null}

      {outcomeDone?.badge ? (
        <Banner tone="success" icon="trophy">
          {outcomeDone.badge.label}. {t('study.done.badgeNote')}
        </Banner>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" size="large" className={styles.startBtn} onClick={continueStudy}>
          {t('study.done.continue')}
        </Button>
        <Button variant="text" to="/app">
          {t('study.done.home')}
        </Button>
      </div>
    </div>
  )
}
