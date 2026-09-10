import { Surface, EmptyState } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDateTime } from '../../lib/format.js'
import styles from './parental.module.css'

export function ParentalActivity({ data }) {
  const t = useT()
  const history = data.history || []
  return (
    <>
      <h1 className={styles.pageTitle}>{t('parental.activity.title')}</h1>
      <Surface>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('parental.activity.history')}</h2>
        </div>
        {history.length ? (
          <ol className={styles.timeline}>
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className={styles.timelineItem}>
                <span className={styles.timelineDate}>{fmtDateTime(h.at)}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon="clock" title={t('parental.activity.empty')} />
        )}
      </Surface>
    </>
  )
}
