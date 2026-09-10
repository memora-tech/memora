import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './study.module.css'
import { Badge, Button, Icon, Sheet, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'
import { NoaExplanation } from './NoaCard.jsx'

const sameDay = (iso) => new Date(iso).toDateString() === new Date().toDateString()

export function NoaPresence() {
  const t = useT()
  const toast = useToast()
  const study = useStudy()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [explain, setExplain] = useState(null)
  const decisions = useAsync(() => studentApi.get('/privacy/decisions'), [])
  const today = study.today
  const suggestion = today?.noaSuggestion
  const budget = today?.noaBudget
  const all = decisions.data?.decisions || []
  const recent = all.slice(0, 3)
  const actions = study.catalog?.actions || []
  const actionOf = (key) => actions.find((a) => a.key === key) || null

  const headline = suggestion ? t('study.noa.pending') : all.find((d) => sameDay(d.at))?.text || recent[0]?.text || t('study.noa.idle')

  const revert = async (d) => {
    try {
      await studentApi.post(`/noa/decisions/${d.id}/revert`)
      toast.show({ message: t('study.noa.reverted'), icon: 'check' })
      decisions.run()
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <>
      <Surface tone="noa" className={styles.noaStrip} onClick={() => setOpen(true)} aria-label={`${t('study.session.noaLabel')}. ${headline}`}>
        <span className={styles.noaStripMark} aria-hidden="true">
          <Icon name="sparkle" size={18} />
        </span>
        <span className={styles.noaStripBody}>
          <span className={styles.noaStripName}>
            {t('study.session.noaLabel')}
            {suggestion ? <span className={styles.noaDot} aria-hidden="true" /> : null}
          </span>
          <span className={styles.noaStripText}>{headline}</span>
        </span>
        <Icon name="chevronRight" size={18} className={styles.noaStripChevron} />
      </Surface>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('study.noa.title')}>
        <p className={styles.noaHint}>{t('study.noa.howItWorks')}</p>

        {suggestion ? (
          <Surface tone="brand" className={styles.noaSheetCard}>
            <Badge tone="noa">{t('study.noa.pendingBadge')}</Badge>
            <strong>{suggestion.title}</strong>
            <span className={styles.planMeta}>{t('study.noa.pendingWhere')}</span>
            <Button
              size="small"
              icon="play"
              onClick={() => {
                setOpen(false)
                if (study.start({ mode: 'today' })) navigate('/app/estudar')
              }}
            >
              {t('study.home.start')}
            </Button>
          </Surface>
        ) : null}

        <div>
          <h3 className={styles.noaSectionTitle}>{t('study.noa.recentTitle')}</h3>
          {recent.length ? (
            recent.map((d) => (
              <div key={d.id} className={styles.noaDecision}>
                <span className={styles.planMeta}>
                  {fmtRelative(d.at)}
                  {actionOf(d.actionKey)?.autonomous ? ` · ${t('study.noa.autonomous')}` : ''}
                </span>
                <span>{d.text}</span>
                <div className={styles.noaDecisionActions}>
                  <Button size="small" variant="text" icon="help" onClick={() => setExplain(d.actionKey)}>
                    {t('study.session.noaWhy')}
                  </Button>
                  {d.reversible && !d.reverted ? (
                    <Button size="small" variant="ghost" icon="refresh" onClick={() => revert(d)}>
                      {t('study.noa.revert')}
                    </Button>
                  ) : d.reverted ? (
                    <Badge>{t('study.noa.reverted')}</Badge>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.planMeta}>{t('study.noa.nothingYet')}</p>
          )}
        </div>

        {budget ? (
          <p className={styles.planMeta}>
            {t('study.session.noaBudget', { used: budget.suggestionsUsed, limit: budget.suggestionsLimit, auto: budget.autonomousUsed, autoLimit: budget.autonomousLimit })}
            {study.catalog?.version ? ` · ${t('study.session.noaCatalog', { version: study.catalog.version })}` : ''}
          </p>
        ) : null}

        <Button variant="ghost" icon="shield" block to="/app/perfil/privacidade" onClick={() => setOpen(false)}>
          {t('study.noa.audit')}
        </Button>
      </Sheet>

      <NoaExplanation open={Boolean(explain)} onClose={() => setExplain(null)} action={actionOf(explain)} budget={budget} catalogVersion={study.catalog?.version} />
    </>
  )
}
