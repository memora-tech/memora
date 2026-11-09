import { Panel, ScreenHeader } from '../../design-system/index.js'
import { PanelEmpty } from '../shared/PanelShell.jsx'
import { useT } from '../../i18n/index.js'
import { fmtDateTime } from '../../lib/format.js'
import styles from './parental.module.css'

export function ParentalActivity({ data }) {
  const t = useT()
  const history = data.history || []
  return (
    <>
      <ScreenHeader size="compact" eyebrow={t('parental.shell.groups.follow')} title={t('parental.activity.title')} lead={t('parental.pages.activityLead')} />
      <Panel tone="quiet" title={t('parental.activity.history')} icon="clock" labelledBy="history-title">
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
          <PanelEmpty icon="clock" title={t('parental.activity.empty')} />
        )}
      </Panel>
    </>
  )
}
