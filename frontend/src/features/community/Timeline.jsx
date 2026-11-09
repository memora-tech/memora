import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './feed.module.css'
import { Avatar, Icon, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { KindTag, itemLink } from './kinds.jsx'
import { RemixBadge } from './Remix.jsx'
import { QuizMini, TimelineMini } from './QuizTimeline.jsx'
import { MiniMap } from './CommunityPulse.jsx'
import { CommentPreview, CommentsPanel, commentsPath } from './Comments.jsx'
import { lengthOf } from './lengthOf.js'

const DAY = 86400000
const EMOJIS = ['👏', '🔥', '🧠', '💡', '❤️', '😂']

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

function Preview({ item }) {
  const t = useT()
  if (item.kind === 'mapa') {
    return (
      <Link to={itemLink(item)} className={styles.previewMap} tabIndex={-1} aria-hidden="true">
        <MiniMap root={item.preview.root} branches={item.preview.branches} />
      </Link>
    )
  }
  if (item.kind === 'quiz') {
    return (
      <Link to={itemLink(item)} className={styles.previewLink} tabIndex={-1} aria-hidden="true">
        <QuizMini sample={item.preview.sample} options={item.preview.options} count={item.preview.questions} />
      </Link>
    )
  }
  if (item.kind === 'linha') {
    return (
      <Link to={itemLink(item)} className={styles.previewLink} tabIndex={-1} aria-hidden="true">
        <TimelineMini marks={item.preview.marks} from={item.preview.from} to={item.preview.to} />
      </Link>
    )
  }
  if (item.kind === 'flashcards') {
    return (
      <Link to={itemLink(item)} className={styles.previewDeck} tabIndex={-1} aria-hidden="true">
        <span className={styles.deckStack}>
          <span className={styles.deckCard} />
          <span className={styles.deckCard} />
          <span className={styles.deckFront}>
            <span className={styles.deckLabel}>{t('common.nav.question')}</span>
            <span className={styles.deckText}>{item.name}</span>
          </span>
        </span>
        <span className={styles.deckFacts}>
          <span className={styles.deckBig}>{fmtNumber(item.cardCount)}</span>
          <span>{t('community.cards', { count: item.cardCount })}</span>
          <span className={styles.deckStudied}>
            <Icon name="flame" size={14} />{' '}
            {t('community.feed.studiedWeek', {
              value: fmtNumber(item.stats.studiedWeek)
            })}
          </span>
        </span>
      </Link>
    )
  }
  if (item.kind === 'noticia' && item.preview?.outlet) {
    return (
      <span className={styles.outlet}>
        <Icon name="globe" size={14} /> {item.preview.outlet}
      </span>
    )
  }
  return null
}

function ReactionBar({ item }) {
  const t = useT()
  const toast = useToast()
  const [reactions, setReactions] = useState(item.reactions || {})
  const [mine, setMine] = useState(item.viewer?.myReactions || [])
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false)
    }
    const esc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        wrap.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const react = async (emoji) => {
    const had = mine.includes(emoji)
    setMine((m) => (had ? m.filter((x) => x !== emoji) : [...m, emoji]))
    setReactions((r) => ({
      ...r,
      [emoji]: Math.max(0, (r[emoji] || 0) + (had ? -1 : 1))
    }))
    setOpen(false)
    try {
      const path = item.kind === 'flashcards' ? `/community/decks/${item.id}/react` : `/community/materials/${item.id}/react`
      const res = await studentApi.post(path, { emoji })
      setReactions(res.reactions)
      setMine(res.mine)
    } catch (err) {
      setReactions(item.reactions || {})
      setMine(item.viewer?.myReactions || [])
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const top = Object.entries(reactions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const total = Object.values(reactions).reduce((s, n) => s + n, 0)

  return (
    <span className={styles.reactWrap} ref={wrap}>
      <button type="button" className={styles.action} data-on={mine.length ? 'true' : 'false'} aria-expanded={open ? 'true' : 'false'} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        <span className={styles.emojis} aria-hidden="true">
          {(mine.length ? mine.slice(0, 1) : [])
            .concat(top.map(([e]) => e).filter((e) => !mine.includes(e)))
            .slice(0, 3)
            .map((e) => (
              <span key={e}>{e}</span>
            ))}
          {!top.length && !mine.length ? <Icon name="plus" size={14} /> : null}
        </span>
        <span className="tabnum">{fmtNumber(total)}</span>
        <span className="sr-only">{t('community.feed.react')}</span>
      </button>
      {open ? (
        <span className={styles.picker} role="group" aria-label={t('community.feed.react')}>
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" className={styles.pick} aria-pressed={mine.includes(emoji) ? 'true' : 'false'} aria-label={t(mine.includes(emoji) ? 'community.deck.reactRemove' : 'community.deck.react', { emoji, count: reactions[emoji] || 0 })} onClick={() => react(emoji)}>
              {emoji}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  )
}

function SaveButton({ item }) {
  const t = useT()
  const toast = useToast()
  const [on, setOn] = useState(Boolean(item.viewer?.favorited))
  const toggle = async () => {
    setOn((v) => !v)
    try {
      const path = item.kind === 'flashcards' ? `/community/decks/${item.id}/favorite` : `/community/materials/${item.id}/favorite`
      const res = await studentApi.post(path)
      setOn(res.favorited)
      toast.show({
        message: res.favorited ? t('community.feed.saved') : t('community.feed.unsaved'),
        icon: res.favorited ? 'heart' : 'check'
      })
    } catch (err) {
      setOn(Boolean(item.viewer?.favorited))
      toast.show({ message: err.message, tone: 'danger' })
    }
  }
  return (
    <button type="button" className={styles.action} data-on={on ? 'true' : 'false'} data-tone="save" aria-pressed={on ? 'true' : 'false'} onClick={toggle}>
      <Icon name="heart" size={16} />
      <span className={styles.actionLabel}>{on ? t('community.feed.savedLabel') : t('community.feed.save')}</span>
    </button>
  )
}

export function Reactions({ reactions }) {
  const t = useT()
  if (!reactions) return null
  const top = Object.entries(reactions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  if (!top.length) return null
  const total = Object.values(reactions).reduce((s, n) => s + n, 0)
  return (
    <span className={styles.staticReactions}>
      <span className={styles.emojis} aria-hidden="true">
        {top.map(([e]) => (
          <span key={e}>{e}</span>
        ))}
      </span>
      <span className="tabnum">{fmtNumber(total)}</span>
      <span className="sr-only">{t('community.deck.reactions')}</span>
    </span>
  )
}

export function TimelineItem({ item, because, onTransform }) {
  const t = useT()
  const title = item.name || item.title
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [count, setCount] = useState(item.commentCount ?? 0)
  const headId = `post-${item.kind}-${item.id}`
  const handle = item.author?.handle ? `@${item.author.handle}` : null
  return (
    <li className={styles.post} data-kind={item.kind}>
      <article className={styles.card} aria-labelledby={headId}>
        <header className={styles.head}>
          {item.author?.id ? (
            <Link to={`/app/comunidade/autor/${item.author.id}`} className={styles.who}>
              <Avatar name={item.author?.name} />
              <span className={styles.whoText}>
                <span className={styles.whoName}>{item.author?.name}</span>
                <span className={styles.whoMeta}>
                  {handle ? <span>{handle}</span> : null}
                  <time dateTime={dateOf(item)}>{fmtRelative(dateOf(item))}</time>
                  {item.kind !== 'flashcards' && item.source?.client ? <span>{t('community.via', { client: item.source.client })}</span> : null}
                </span>
              </span>
            </Link>
          ) : (
            <span className={styles.who}>
              <Avatar name={item.author?.name} />
              <span className={styles.whoText}>
                <span className={styles.whoName}>{item.author?.name}</span>
                <span className={styles.whoMeta}>
                  <time dateTime={dateOf(item)}>{fmtRelative(dateOf(item))}</time>
                </span>
              </span>
            </span>
          )}
          <KindTag kind={item.kind} small />
        </header>

        <div className={styles.content}>
          <h3 id={headId} className={styles.title}>
            <Link to={itemLink(item)} className={styles.titleLink}>
              {title}
            </Link>
          </h3>
          {item.remixOf ? <RemixBadge remixOf={item.remixOf} compact /> : null}
          {excerptOf(item) ? <p className={styles.excerpt}>{excerptOf(item)}</p> : null}
          <Preview item={item} />
          <div className={styles.facts}>
            <span className={styles.category}>{item.categoryName}</span>
            <span className={styles.fact}>
              <Icon name="clock" size={13} /> {item.kind === 'flashcards' ? t('community.cards', { count: item.cardCount }) : lengthOf(t, item)}
            </span>
            {item.remixCount ? (
              <span className={styles.fact}>
                <Icon name="refresh" size={13} /> {t('community.remix.count', { count: item.remixCount })}
              </span>
            ) : null}
            {(item.tags || []).slice(0, 3).map((tag) => (
              <Link key={tag} to={`/app/comunidade/busca?q=${encodeURIComponent(tag)}`} className={styles.tag}>
                #{tag}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.bar}>
          <ReactionBar item={item} />
          <button type="button" className={styles.action} aria-expanded={commentsOpen ? 'true' : 'false'} aria-controls={`${headId}-comments`} onClick={() => setCommentsOpen((v) => !v)}>
            <Icon name="message" size={16} />
            <span className="tabnum">{fmtNumber(count)}</span>
            <span className="sr-only">{t('community.deck.comments', { count })}</span>
          </button>
          <SaveButton item={item} />
          {onTransform ? (
            <button type="button" className={[styles.action, styles.ai].join(' ')} onClick={() => onTransform(item)} aria-label={`${t('ai.transform.action')}: ${title}`}>
              <Icon name="sparkle" size={16} />
              <span className={styles.actionLabel} aria-hidden="true">
                {t('ai.transform.action')}
              </span>
            </button>
          ) : null}
        </div>

        <div id={`${headId}-comments`} className={styles.comments}>
          {commentsOpen ? <CommentsPanel basePath={commentsPath(item)} authorId={item.authorId || item.author?.id} limit={3} autoFocus headingLevel={4} onCountChange={setCount} /> : <CommentPreview preview={item.commentPreview} total={count} onOpen={() => setCommentsOpen(true)} />}
        </div>
        {because ? <p className={styles.because}>{because}</p> : null}
      </article>
    </li>
  )
}

export function Timeline({ items, emptyText, onTransform, grouped = true }) {
  const t = useT()
  if (!items.length) {
    return (
      <div className={styles.empty}>
        <Icon name="search" size={22} />
        <p>{emptyText}</p>
      </div>
    )
  }
  if (!grouped) {
    return (
      <ol className={styles.list}>
        {items.map((item) => (
          <TimelineItem key={`${item.kind}-${item.id}`} item={item} onTransform={onTransform} />
        ))}
      </ol>
    )
  }
  const groups = BUCKETS.map((key) => ({
    key,
    items: items.filter((i) => bucketOf(dateOf(i)) === key)
  })).filter((g) => g.items.length)
  return (
    <div className={styles.feed}>
      {groups.map((g) => (
        <section key={g.key} className={styles.group} aria-labelledby={`tl-${g.key}`}>
          <h2 id={`tl-${g.key}`} className={styles.groupTitle}>
            <span>{t(`community.timeline.${g.key}`)}</span>
            <span className={styles.groupCount}>{g.items.length}</span>
          </h2>
          <ol className={styles.list}>
            {g.items.map((item) => (
              <TimelineItem key={`${item.kind}-${item.id}`} item={item} onTransform={onTransform} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
