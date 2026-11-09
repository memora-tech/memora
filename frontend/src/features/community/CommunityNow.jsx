import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import styles from '../study/home.module.css'
import { Avatar, Icon, Skeleton } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { KindTag, itemLink } from './kinds.jsx'
import { dateOf } from './Timeline.jsx'
import { pulseOf } from './CommunityPulse.jsx'

export function CommunityNow() {
  const t = useT()
  const feed = useAsync(() => studentApi.get('/community/feed'), [])
  const items = useMemo(() => {
    const data = feed.data
    if (!data) return []
    return [...data.highlights.map((d) => ({ kind: 'flashcards', ...d })), ...Object.values(data.materials || {}).flat()].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
  }, [feed.data])

  if (feed.loading && !items.length) {
    return (
      <section className={styles.community} aria-busy="true" aria-labelledby="community-now">
        <h3 id="community-now" className={styles.blockTitle}>
          {t('community.now.title')}
        </h3>
        <div className={styles.communityGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={132} />
          ))}
        </div>
      </section>
    )
  }
  if (!items.length) return null

  const pulse = pulseOf(items)
  return (
    <section className={styles.community} aria-labelledby="community-now">
      <header className={styles.blockHead}>
        <div className={styles.blockHeadText}>
          <h3 id="community-now" className={styles.blockTitle}>
            <span className={styles.liveDot} aria-hidden="true" />
            {t('community.now.title')}
          </h3>
          <p className={styles.blockLead}>{t('community.now.meta', { count: pulse.week, sessions: fmtNumber(pulse.sessions) })}</p>
        </div>
        <Link to="/app/comunidade" className={styles.blockLink}>
          {t('community.now.open')}
          <Icon name="arrowRight" size={16} />
        </Link>
      </header>
      <ul className={styles.communityGrid}>
        {items.slice(0, 4).map((item) => {
          const studying = item.stats?.studiedWeek
          const views = item.stats?.views
          return (
            <li key={`${item.kind}-${item.id}`} className={styles.communityItem}>
              <Link to={itemLink(item)} className={styles.communityCard} data-kind={item.kind}>
                <KindTag kind={item.kind} small />
                <span className={styles.communityName}>{item.name || item.title}</span>
                <span className={styles.communityFoot}>
                  <Avatar name={item.author?.name} />
                  <span className={styles.communityMeta}>
                    <span className={styles.communityAuthor}>{item.author?.name}</span>
                    <span>
                      {fmtRelative(dateOf(item))}
                      {studying ? ` · ${t('study.home.next.studying', { count: fmtNumber(studying) })}` : views ? ` · ${t('study.home.next.views', { count: fmtNumber(views) })}` : ''}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
