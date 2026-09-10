import { useState } from 'react'
import styles from './study.module.css'
import { Badge, Button, Sheet, Surface } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

export function NoaExplanation({ open, onClose, action, budget, catalogVersion, signals }) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={t('study.session.noaExplainTitle')}>
      {action ? (
        <div className={styles.sheetList}>
          <p>{action.explanation}</p>
          {signals ? <p className={styles.planMeta}>{t('study.session.fatigueWhy', { signals })}</p> : null}
          <div className={styles.sheetRow}>
            <strong>{t('study.session.noaTrigger')}</strong>
            <span>{action.trigger}</span>
          </div>
          <div className={styles.sheetRow}>
            <strong>{t('study.session.noaThreshold')}</strong>
            <span>{action.threshold}</span>
          </div>
          <div className={styles.sheetRow}>
            <strong>{t('study.session.noaEffect')}</strong>
            <span style={{ textAlign: 'right' }}>{action.effect}</span>
          </div>
          <div className={styles.sheetRow}>
            <strong>{t('study.session.noaCost')}</strong>
            <span>{t('study.session.noaTokens', { count: action.tokenCost })}</span>
          </div>
          {budget ? <p className={styles.planMeta}>{t('study.session.noaBudget', { used: budget.suggestionsUsed, limit: budget.suggestionsLimit, auto: budget.autonomousUsed, autoLimit: budget.autonomousLimit })}</p> : null}
          {catalogVersion ? <p className={styles.planMeta}>{t('study.session.noaCatalog', { version: catalogVersion })}</p> : null}
        </div>
      ) : null}
    </Sheet>
  )
}

export function NoaCard({ title, body, onAccept, onDismiss, onWhy, compact }) {
  const t = useT()
  return (
    <Surface tone="noa" className={styles.noaCard} aria-label={t('study.session.noaLabel')}>
      <div className={styles.noaHead}>
        <Badge tone="noa">{t('study.session.noaLabel')}</Badge>
      </div>
      <h2 className={styles.noaTitle}>{title}</h2>
      {body ? <p className={styles.noaBody}>{body}</p> : null}
      <div className={styles.noaActions}>
        {onAccept ? (
          <Button size={compact ? 'small' : undefined} onClick={onAccept}>
            {t('study.session.noaAccept')}
          </Button>
        ) : null}
        {onDismiss ? (
          <Button size={compact ? 'small' : undefined} variant="ghost" onClick={onDismiss}>
            {onAccept ? t('study.session.noaDismiss') : t('common.actions.understand')}
          </Button>
        ) : null}
        {onWhy ? (
          <Button size={compact ? 'small' : undefined} variant="text" onClick={onWhy}>
            {t('study.session.noaWhy')}
          </Button>
        ) : null}
      </div>
    </Surface>
  )
}

export function useNoaExplain() {
  const [open, setOpen] = useState(false)
  return { open, show: () => setOpen(true), hide: () => setOpen(false) }
}
