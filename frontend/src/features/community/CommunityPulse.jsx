import { Link } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber } from '../../lib/format.js'
import { FormatArt } from '../noa/AiFormats.jsx'
import { KindTag, itemLink } from './kinds.jsx'
import { dateOf } from './Timeline.jsx'
import { TimelineMini } from './QuizTimeline.jsx'

const WEEK = 7 * 86400000

export function pulseOf(items) {
  const now = Date.now()
  const week = items.filter((i) => now - new Date(dateOf(i)).getTime() <= WEEK)
  const authors = new Map()
  items.forEach((i) => {
    if (i.author?.id && !authors.has(i.author.id)) authors.set(i.author.id, i.author)
  })
  const sessions = items.reduce((sum, i) => sum + (i.stats?.studiedWeek || 0), 0)
  const reads = items.reduce((sum, i) => sum + (i.stats?.views || 0), 0)
  const comments = items.reduce((sum, i) => sum + (i.commentCount || 0), 0)
  return { week: week.length, authors: [...authors.values()], sessions, reads, comments }
}

export function PulseBar({ pulse }) {
  const t = useT()
  const shown = pulse.authors.slice(0, 5)
  const names = shown.slice(0, 2).map((a) => a.name.split(' ')[0])
  const rest = Math.max(0, pulse.authors.length - names.length)
  return (
    <div className={styles.pulse}>
      <span className={styles.pulseLive}>
        <span className={styles.pulseDot} aria-hidden="true" />
        {t('community.pulse.live')}
      </span>
      <span className={styles.pulseFaces} aria-hidden="true">
        {shown.map((a) => (
          <Avatar key={a.id} name={a.name} />
        ))}
      </span>
      <span className={styles.pulseWho}>{rest ? t('community.pulse.who', { names: names.join(', '), count: rest }) : t('community.pulse.whoFew', { names: names.join(' e ') })}</span>
      <dl className={styles.pulseStats}>
        <div>
          <dt>{t('community.pulse.week')}</dt>
          <dd className="tabnum">{fmtNumber(pulse.week)}</dd>
        </div>
        <div>
          <dt>{t('community.pulse.sessions')}</dt>
          <dd className="tabnum">{fmtNumber(pulse.sessions)}</dd>
        </div>
        <div>
          <dt>{t('community.pulse.reads')}</dt>
          <dd className="tabnum">{fmtNumber(pulse.reads)}</dd>
        </div>
        <div>
          <dt>{t('community.pulse.creators')}</dt>
          <dd className="tabnum">{fmtNumber(pulse.authors.length)}</dd>
        </div>
      </dl>
    </div>
  )
}

function scoreOf(item) {
  return (item.stats?.studiedWeek || 0) * 2 + (item.stats?.views || 0) + (item.stats?.favorites || 0)
}

export function Spotlight({ items, onTransform }) {
  const t = useT()
  const picks = []
  const seen = new Set()
  ;[...items]
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .forEach((i) => {
      if (picks.length < 6 && !seen.has(i.kind)) {
        picks.push(i)
        seen.add(i.kind)
      }
    })
  if (!picks.length) return null
  return (
    <section className={styles.spotlight} aria-labelledby="spot-title">
      <header className={styles.spotHead}>
        <h2 id="spot-title" className={styles.tlHeading}>
          <Icon name="flame" size={18} /> {t('community.spotlight.title')}
        </h2>
        <span className={styles.meta}>{t('community.spotlight.lead')}</span>
      </header>
      <ul className={styles.spotGrid}>
        {picks.map((item) => {
          const title = item.name || item.title
          const metric = item.kind === 'flashcards' ? t('community.spotlight.studied', { value: fmtNumber(item.stats.studiedWeek) }) : t('community.spotlight.read', { value: fmtNumber(item.stats.views) })
          return (
            <li key={`${item.kind}-${item.id}`} className={styles.spot} data-kind={item.kind}>
              <span className={styles.spotArt} aria-hidden="true">
                {item.kind === 'noticia' ? (
                  <span className={styles.spotNews}>
                    <Icon name="news" size={28} />
                    <span>{item.preview?.outlet || t('community.kinds.noticia')}</span>
                  </span>
                ) : item.kind === 'mapa' ? (
                  <MiniMap root={item.preview?.root} branches={item.preview?.branches || []} />
                ) : item.kind === 'linha' ? (
                  <TimelineMini marks={item.preview?.marks} />
                ) : (
                  <FormatArt kind={item.kind} />
                )}
              </span>
              <span className={styles.spotBody}>
                <KindTag kind={item.kind} small />
                <Link to={itemLink(item)} className={styles.spotLink}>
                  {title}
                </Link>
                <span className={styles.spotMeta}>
                  <Avatar name={item.author?.name} />
                  <span>{item.author?.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{metric}</span>
                </span>
              </span>
              {onTransform ? (
                <button type="button" className={styles.spotTransform} onClick={() => onTransform(item)} aria-label={`${t('ai.transform.action')}: ${title}`}>
                  <Icon name="sparkle" size={16} />
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function MiniMap({ root, branches }) {
  const shown = branches.slice(0, 4)
  const pos = [
    [8, 8],
    [8, 60],
    [132, 8],
    [132, 60]
  ]
  return (
    <svg viewBox="0 0 220 84" className={styles.miniMap}>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.45">
        {shown.map((_, i) => {
          const [x, y] = pos[i]
          const ex = x < 100 ? x + 80 : x
          return <path key={i} d={`M110 42 C${x < 100 ? 90 : 130} 42 ${x < 100 ? 100 : 120} ${y + 8} ${ex} ${y + 8}`} />
        })}
      </g>
      <rect x="66" y="30" width="88" height="24" rx="12" fill="currentColor" />
      <text x="110" y="46" textAnchor="middle" className={styles.miniMapRoot}>
        {clip(root, 14)}
      </text>
      {shown.map((b, i) => {
        const [x, y] = pos[i]
        return (
          <g key={b}>
            <rect x={x} y={y} width="80" height="16" rx="8" className={styles.miniMapNode} />
            <text x={x + 40} y={y + 11.5} textAnchor="middle" className={styles.miniMapText}>
              {clip(b, 12)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function clip(text = '', n) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

export function TopicCloud({ items }) {
  const t = useT()
  const counts = new Map()
  items.forEach((i) => (i.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)))
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  if (!tags.length) return null
  return (
    <section className={styles.railCard} aria-labelledby="rail-topics">
      <h2 id="rail-topics" className={styles.railTitle}>
        <Icon name="tag" size={16} /> {t('community.topics')}
      </h2>
      <ul className={styles.topicList}>
        {tags.map(([tag, n]) => (
          <li key={tag}>
            <Link to={`/app/comunidade/busca?q=${encodeURIComponent(tag)}`} className={styles.topic}>
              #{tag}
              <span className={styles.topicCount}>{n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CreatorFeature({ creator }) {
  const t = useT()
  if (!creator) return null
  return (
    <Link to={`/app/comunidade/autor/${creator.id}`} className={styles.creatorFeature}>
      <span className={styles.creatorFeatureTag}>
        <Icon name="trophy" size={14} /> {t('community.creatorOfMonth')}
      </span>
      <span className={styles.creatorFeatureMain}>
        <Avatar name={creator.name} large />
        <span className={styles.creatorFeatureText}>
          <span className={styles.creatorFeatureName}>{creator.name}</span>
          <span className={styles.rankMeta}>
            @{creator.handle} · {t('community.author.level', { level: creator.level, topic: creator.topic })}
          </span>
        </span>
      </span>
      {creator.bio ? <span className={styles.creatorFeatureBio}>{creator.bio}</span> : null}
      <span className={styles.creatorFeatureStats}>
        <span>
          <strong className="tabnum">{fmtNumber(creator.followers)}</strong> {t('community.author.labels.followers')}
        </span>
        <span>
          <strong className="tabnum">{creator.decksCount}</strong> {t('community.author.labels.decks')}
        </span>
      </span>
    </Link>
  )
}
