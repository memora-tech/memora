import { Link } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { KIND_ICON, KindTag, itemLink } from './kinds.jsx'

const DAY = 86400000

export const dateOf = (item) => item.publishedAt || item.createdAt || ''

function bucketOf(iso, now = new Date()) {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = new Date(iso).getTime()
  if (time >= startToday) return 'today'
  if (time >= startToday - DAY) return 'yesterday'
  if (time >= startToday - 6 * DAY) return 'week'
  if (time >= startToday - 30 * DAY) return 'month'
  return 'older'
}

const BUCKETS = ['today', 'yesterday', 'week', 'month', 'older']

function excerptOf(item) {
  return item.kind === 'flashcards' ? item.description : item.excerpt
}

function Extra({ item }) {
  if (item.kind === 'mapa') {
    return (
      <span className={styles.tlBranches}>
        {item.preview.branches.slice(0, 4).map((b) => (
          <span key={b} className={styles.tlBranch}>
            {b}
          </span>
        ))}
        {item.preview.branches.length > 4 ? <span className={styles.tlBranchMore}>+{item.preview.branches.length - 4}</span> : null}
      </span>
    )
  }
  if (item.kind === 'noticia' && item.preview?.outlet) {
    return (
      <span className={styles.tlOutlet}>
        <Icon name="globe" size={14} /> {item.preview.outlet}
      </span>
    )
  }
  return null
}

function Stats({ item }) {
  const t = useT()
  if (item.kind === 'flashcards') {
    return (
      <>
        <span className={styles.tlStat}>
          <Icon name="layers" size={14} />
          {t('community.cards', { count: item.cardCount })}
        </span>
        <span className={styles.tlStat}>
          <Icon name="book" size={14} />
          {fmtNumber(item.stats.studiedWeek)} <span className="sr-only">{t('community.studiedLabel')}</span>
        </span>
        <span className={styles.tlStat}>
          <Icon name="star" size={14} />
          {fmtNumber(item.stats.votes)} <span className="sr-only">{t('community.votesLabel')}</span>
        </span>
        <span className={styles.tlStat}>
          <Icon name="message" size={14} />
          {item.commentCount ?? 0} <span className="sr-only">{t('community.deck.comments', { count: item.commentCount ?? 0 })}</span>
        </span>
      </>
    )
  }
  return (
    <>
      <span className={styles.tlStat}>
        <Icon name="clock" size={14} />
        {item.kind === 'mapa' ? t('community.nodes', { count: item.preview.nodes }) : t('community.readingTime', { count: item.readingMinutes })}
      </span>
      <span className={styles.tlStat}>
        <Icon name="eye" size={14} />
        {fmtNumber(item.stats.views)} <span className="sr-only">{t('community.viewsLabel')}</span>
      </span>
      <span className={styles.tlStat}>
        <Icon name="heart" size={14} />
        {fmtNumber(item.stats.favorites)} <span className="sr-only">{t('community.favoritesLabel')}</span>
      </span>
      <span className={styles.tlStat}>
        <Icon name="message" size={14} />
        {item.commentCount ?? 0} <span className="sr-only">{t('community.deck.comments', { count: item.commentCount ?? 0 })}</span>
      </span>
    </>
  )
}

export function TimelineItem({ item, because }) {
  const t = useT()
  const title = item.name || item.title
  return (
    <li className={styles.tlItem} data-kind={item.kind}>
      <span className={styles.tlMarker} aria-hidden="true">
        <Icon name={KIND_ICON[item.kind]} size={16} />
      </span>
      <article className={styles.tlCard}>
        <header className={styles.tlHead}>
          <KindTag kind={item.kind} small />
          <span className={styles.tlAuthor}>
            <Avatar name={item.author?.name} />
            <span>{item.author?.name}</span>
          </span>
          <time className={styles.tlTime} dateTime={dateOf(item)}>
            {fmtRelative(dateOf(item))}
          </time>
        </header>
        <h3 className={styles.tlTitle}>
          <Link to={itemLink(item)} className={styles.tlLink}>
            {title}
          </Link>
        </h3>
        {excerptOf(item) ? <p className={styles.tlExcerpt}>{excerptOf(item)}</p> : null}
        <Extra item={item} />
        <footer className={styles.tlFoot}>
          <span className={styles.tlCategory}>{item.categoryName}</span>
          <Stats item={item} />
          {item.kind !== 'flashcards' && item.source?.client ? <span className={styles.tlVia}>{t('community.via', { client: item.source.client })}</span> : null}
        </footer>
        {because ? <p className={styles.tlBecause}>{because}</p> : null}
      </article>
    </li>
  )
}

export function Timeline({ items, emptyText }) {
  const t = useT()
  if (!items.length) return <p className={styles.meta}>{emptyText}</p>
  const groups = BUCKETS.map((key) => ({ key, items: items.filter((i) => bucketOf(dateOf(i)) === key) })).filter((g) => g.items.length)
  return (
    <div className={styles.timeline}>
      {groups.map((g) => (
        <section key={g.key} className={styles.tlGroup} aria-labelledby={`tl-${g.key}`}>
          <h2 id={`tl-${g.key}`} className={styles.tlGroupTitle}>
            {t(`community.timeline.${g.key}`)}
            <span className={styles.tlGroupCount}>{g.items.length}</span>
          </h2>
          <ol className={styles.tlList}>
            {g.items.map((item) => (
              <TimelineItem key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
