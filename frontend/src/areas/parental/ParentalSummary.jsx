import { Panel, ScreenHeader, StatTile, Badge, Avatar, Chip, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../../lib/format.js'
import { Meter, PanelEmpty, Trend, panelStyles } from '../shared/PanelShell.jsx'
import styles from './parental.module.css'

export function ParentalSummary({ data }) {
  const t = useT()
  const { child, weeklySummary, decks, gamification, milestones, guardian } = data
  const accuracyTone = weeklySummary.accuracy >= 75 ? 'success' : weeklySummary.accuracy >= 60 ? 'warning' : 'danger'

  return (
    <>
      <ScreenHeader size="compact" eyebrow={t('parental.shell.groups.follow')} title={t('parental.nav.summary')} lead={t('parental.pages.summaryLead', { name: child.name.split(' ')[0] })} />

      <div className={panelStyles.kpis}>
        <StatTile size="compact" icon="flame" tone="reward" label={t('parental.child.streak')} value={fmtNumber(child.streak)} note={t('parental.pages.streakNote', { count: child.studyDays })} />
        <StatTile size="compact" icon="calendar" label={t('parental.weekly.studyDays')} value={fmtNumber(weeklySummary.studyDays)} note={<Meter value={weeklySummary.studyDays} max={7} tone="brand" label={t('parental.pages.daysOfSeven', { count: weeklySummary.studyDays })} />} />
        <StatTile size="compact" icon="layers" label={t('parental.pages.weekCards')} value={fmtNumber(weeklySummary.cards)} note={t('parental.pages.weekMinutes') + ': ' + fmtNumber(weeklySummary.minutes)} />
        <StatTile size="compact" icon="target" label={t('parental.weekly.accuracy')} value={`${weeklySummary.accuracy}%`} note={<Trend tone={accuracyTone}>{t('parental.pages.accuracyNote')}</Trend>} />
      </div>

      <div className={panelStyles.split}>
        <div className={panelStyles.stack}>
          <Panel tone="quiet" title={t('parental.weekly.title')} icon="chart" labelledBy="weekly-title" action={<span className={styles.panelMeta}>{t('parental.weekly.weekOf', { date: fmtDate(weeklySummary.weekOf) })}</span>}>
            <h3 className={styles.label}>{t('parental.weekly.subjects')}</h3>
            <ul className={styles.subjects}>
              {weeklySummary.subjects.map((s) => (
                <li key={s.name} className={styles.subject}>
                  <div className={styles.subjectRow}>
                    <span className={styles.subjectName}>{s.name}</span>
                    <span>{t('parental.weekly.subjectMeta', { cards: s.cards, accuracy: s.accuracy })}</span>
                  </div>
                  <Meter value={s.accuracy} tone={s.accuracy >= 75 ? 'success' : s.accuracy >= 60 ? 'warning' : 'danger'} label={`${s.name}: ${s.accuracy}%`} />
                </li>
              ))}
            </ul>
            <p className={styles.cardSub}>
              <Icon name="mail" size={14} /> {t('parental.weekly.emailNote')}
            </p>
          </Panel>

          <Panel tone="quiet" title={t('parental.decks.title')} icon="book" labelledBy="decks-title" bodyClassName={styles.panelFlush}>
            {decks.length ? (
              <ul className={styles.deckList}>
                {decks.map((d) => (
                  <li key={d.id} className={styles.deckRow}>
                    <span className={styles.deckIcon} aria-hidden="true">
                      <Icon name="book" size={16} />
                    </span>
                    <span className={styles.deckText}>
                      <span className={styles.deckName}>{d.name}</span>
                      <span className={styles.deckMeta}>{t('parental.decks.meta', { category: d.categoryName, total: d.progress.total, due: d.progress.due })}</span>
                    </span>
                    <span className={styles.deckWhen}>{d.lastStudiedAt ? t('parental.decks.lastStudied', { when: fmtRelative(d.lastStudiedAt) }) : t('parental.decks.never')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <PanelEmpty icon="book" title={t('parental.decks.empty')} />
            )}
          </Panel>
        </div>

        <div className={panelStyles.stack}>
          <Panel tone="quiet" title={t('parental.child.title')} icon="user" labelledBy="child-title">
            <div className={styles.childRow}>
              <Avatar name={child.name} large />
              <div>
                <div className={styles.childName}>{child.name}</div>
                <div className={styles.childMeta}>
                  {t('parental.child.age', { count: child.age })} · {t('parental.child.linked', { date: fmtDate(child.verifiedAt) })}
                </div>
              </div>
            </div>
            <dl className={panelStyles.definition}>
              <dt>{t('parental.child.quietWindow')}</dt>
              <dd>{t('parental.child.quietWindowValue', { start: child.quietWindow.start, end: child.quietWindow.end })}</dd>
              <dt>{t('parental.child.tone')}</dt>
              <dd>
                <Chip tone="neutral" icon="lock">
                  {child.notificationIntensity === 'leve' ? t('parental.child.toneValue') : child.notificationIntensity}
                </Chip>
              </dd>
            </dl>
          </Panel>

          <Panel tone="quiet" title={t('parental.gamification.title')} icon="neuron" labelledBy="gamification-title" action={<Badge tone="reward" icon="neuron">{`${fmtNumber(gamification.balance)} ${t('parental.gamification.unit')}`}</Badge>}>
            <p className={styles.bodyText}>{gamification.note}</p>
          </Panel>

          <Panel tone="quiet" title={t('parental.verification.title')} icon="shield" labelledBy="verification-title">
            <Badge tone="success" icon="check">
              {t('parental.verification.status')}
            </Badge>
            <dl className={panelStyles.definition}>
              <dt>{t('parental.verification.method')}</dt>
              <dd>{guardian.method}</dd>
              <dt>{t('parental.verification.date')}</dt>
              <dd>{fmtDateTime(child.verifiedAt)}</dd>
              <dt>{t('parental.verification.hash')}</dt>
              <dd className={panelStyles.mono}>{child.documentHash}</dd>
              <dt>{t('parental.verification.verifiedBy')}</dt>
              <dd>{child.verifiedBy}</dd>
            </dl>
            <p className={styles.deleted}>
              <Icon name="trash" size={16} />
              <span>{t('parental.verification.deleted', { date: fmtDateTime(child.documentDeletedAt) })}</span>
            </p>
            <p className={styles.cardSub}>{t('parental.verification.retained')}</p>
            <p className={styles.cardSub}>{t('parental.verification.guardian', { date: fmtDate(guardian.verifiedAt) })}</p>
          </Panel>
        </div>
      </div>

      <Panel tone="quiet" title={t('parental.milestones.title')} icon="route" labelledBy="milestones-title">
        <ol className={styles.milestones}>
          <li className={styles.milestone}>
            <span className={styles.milestoneAge}>{t('parental.milestones.at', { age: 13 })}</span>
            <span>{t('parental.milestones.thirteen')}</span>
          </li>
          {milestones.map((m) => (
            <li key={m.age} className={styles.milestone} data-next={child.age < m.age && child.age >= m.age - 2 ? 'true' : undefined}>
              <span className={styles.milestoneAge}>{t('parental.milestones.at', { age: m.age })}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
        {weeklySummary.milestones?.length ? (
          <ul className={panelStyles.rules}>
            {weeklySummary.milestones.map((text) => (
              <li key={text}>
                <Icon name="info" size={16} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </>
  )
}
