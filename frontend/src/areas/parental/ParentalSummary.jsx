import { Surface, Stat, ProgressBar, ListItem, Badge, Banner, Avatar, Chip, EmptyState, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../../lib/format.js'
import styles from './parental.module.css'

export function ParentalSummary({ data }) {
  const t = useT()
  const { child, weeklySummary, decks, gamification, milestones, guardian } = data

  return (
    <>
      <h1 className={styles.pageTitle}>{t('parental.nav.summary')}</h1>

      <Surface>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('parental.child.title')}</h2>
          <Chip tone="neutral" icon="lock">
            {t('parental.child.toneValue')}
          </Chip>
        </div>
        <div className={styles.childRow}>
          <Avatar name={child.name} large />
          <div>
            <div className={styles.childName}>{child.name}</div>
            <div className={styles.childMeta}>
              {t('parental.child.age', { count: child.age })} · {t('parental.child.linked', { date: fmtDate(child.verifiedAt) })}
            </div>
          </div>
        </div>
        <div className={styles.kpis} style={{ marginTop: 'var(--space-4)' }}>
          <Stat value={fmtNumber(child.streak)} label={t('parental.child.streak')} />
          <Stat value={fmtNumber(child.studyDays)} label={t('parental.child.studyDays')} />
          <Stat value={t('parental.child.quietWindowValue', { start: child.quietWindow.start, end: child.quietWindow.end })} label={t('parental.child.quietWindow')} />
          <Stat value={child.notificationIntensity === 'leve' ? t('parental.child.toneValue') : child.notificationIntensity} label={t('parental.child.tone')} />
        </div>
      </Surface>

      <div className={`${styles.grid} ${styles.grid2}`}>
        <Surface>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>{t('parental.weekly.title')}</h2>
              <p className={styles.cardSub}>{t('parental.weekly.weekOf', { date: fmtDate(weeklySummary.weekOf) })}</p>
            </div>
          </div>
          <div className={styles.kpis}>
            <Stat value={fmtNumber(weeklySummary.studyDays)} label={t('parental.weekly.studyDays')} />
            <Stat value={fmtNumber(weeklySummary.cards)} label={t('parental.weekly.cards')} />
            <Stat value={fmtNumber(weeklySummary.minutes)} label={t('parental.weekly.minutes')} />
            <Stat value={`${weeklySummary.accuracy}%`} label={t('parental.weekly.accuracy')} />
          </div>
          <h3 className={styles.cardSub} style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
            {t('parental.weekly.subjects')}
          </h3>
          <div className={styles.subjects}>
            {weeklySummary.subjects.map((s) => (
              <div key={s.name} className={styles.subject}>
                <div className={styles.subjectRow}>
                  <span>{s.name}</span>
                  <span>{t('parental.weekly.subjectMeta', { cards: s.cards, accuracy: s.accuracy })}</span>
                </div>
                <ProgressBar value={s.accuracy} label={`${s.name}: ${s.accuracy}%`} thin />
              </div>
            ))}
          </div>
          <p className={styles.cardSub} style={{ marginTop: 'var(--space-4)' }}>
            {t('parental.weekly.emailNote')}
          </p>
        </Surface>

        <Surface>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('parental.decks.title')}</h2>
          </div>
          {decks.length ? (
            <div className={styles.list}>
              {decks.map((d) => (
                <ListItem
                  key={d.id}
                  icon="book"
                  title={d.name}
                  meta={`${t('parental.decks.meta', { category: d.categoryName, total: d.progress.total, due: d.progress.due })} · ${d.lastStudiedAt ? t('parental.decks.lastStudied', { when: fmtRelative(d.lastStudiedAt) }) : t('parental.decks.never')}`}
                  chevron={false}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="book" title={t('parental.decks.empty')} />
          )}
        </Surface>
      </div>

      <div className={`${styles.grid} ${styles.grid2}`}>
        <Surface tone="brand">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('parental.gamification.title')}</h2>
            <Badge tone="reward" icon="neuron">
              {fmtNumber(gamification.balance)} {t('parental.gamification.unit')}
            </Badge>
          </div>
          <p>{gamification.note}</p>
        </Surface>

        <Surface>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t('parental.verification.title')}</h2>
            <Badge tone="success" icon="check">
              {t('parental.verification.status')}
            </Badge>
          </div>
          <dl className={styles.definitions}>
            <dt>{t('parental.verification.method')}</dt>
            <dd>{guardian.method}</dd>
            <dt>{t('parental.verification.date')}</dt>
            <dd>{fmtDateTime(child.verifiedAt)}</dd>
            <dt>{t('parental.verification.hash')}</dt>
            <dd className="tabnum">{child.documentHash}</dd>
            <dt>{t('parental.verification.verifiedBy')}</dt>
            <dd>{child.verifiedBy}</dd>
          </dl>
          <div className={styles.notes} style={{ marginTop: 'var(--space-4)' }}>
            <Banner tone="success" icon="trash">
              {t('parental.verification.deleted', { date: fmtDateTime(child.documentDeletedAt) })}
            </Banner>
            <p className={styles.cardSub}>{t('parental.verification.retained')}</p>
            <p className={styles.cardSub}>{t('parental.verification.guardian', { date: fmtDate(guardian.verifiedAt) })}</p>
          </div>
        </Surface>
      </div>

      <Surface>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('parental.milestones.title')}</h2>
          <Icon name="route" size={22} />
        </div>
        <div className={styles.milestones}>
          <div className={styles.milestone}>
            <span className={styles.milestoneAge}>{t('parental.milestones.at', { age: 13 })}</span>
            <span>{t('parental.milestones.thirteen')}</span>
          </div>
          {milestones.map((m) => (
            <div key={m.age} className={styles.milestone}>
              <span className={styles.milestoneAge}>{t('parental.milestones.at', { age: m.age })}</span>
              <span>{m.text}</span>
            </div>
          ))}
          {weeklySummary.milestones?.map((text) => (
            <div key={text} className={styles.milestone}>
              <span className={styles.milestoneAge}>
                <Icon name="info" size={18} />
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </Surface>
    </>
  )
}
