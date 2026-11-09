import { useCallback, useEffect, useId, useRef, useState } from 'react'
import styles from './comments.module.css'
import { Avatar, Button, Icon, Skeleton, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { useSession } from '../../state/SessionContext.jsx'

export function commentsPath(item) {
  return item.kind === 'flashcards' ? `/community/decks/${item.id}` : `/community/materials/${item.id}`
}

function useSendComment(basePath, onSent) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const send = async (text, parentId) => {
    setBusy(true)
    try {
      await studentApi.post(`${basePath}/comments`, {
        text,
        parentId: parentId || null
      })
      await onSent?.()
      return true
    } catch (err) {
      if (err.code === 'verification_required')
        toast.show({
          message: t('community.deck.verifyToComment'),
          tone: 'danger'
        })
      else if (err.code === 'guardian_required')
        toast.show({
          message: `${t('community.deck.guardianToComment')} ${t('common.guardian.requestSent')}`,
          icon: 'shield',
          duration: 6000
        })
      else toast.show({ message: err.message, tone: 'danger' })
      return false
    } finally {
      setBusy(false)
    }
  }
  return { send, busy }
}

function Composer({ onSend, busy, placeholder, autoFocus, onCancel, small }) {
  const t = useT()
  const session = useSession()
  const [text, setText] = useState('')
  const ref = useRef(null)
  const id = useId()
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  const submit = async () => {
    if (!text.trim() || busy) return
    if (await onSend(text.trim())) setText('')
  }
  return (
    <form
      className={styles.composer}
      data-small={small ? 'true' : 'false'}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Avatar name={session.user?.name} />
      <div className={styles.composerBox} data-filled={text.trim() ? 'true' : 'false'}>
        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <textarea
          id={id}
          ref={ref}
          className={styles.composerField}
          placeholder={placeholder}
          value={text}
          rows={1}
          maxLength={2000}
          onChange={(e) => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape' && onCancel) onCancel()
          }}
        />
        <span className={styles.composerActions}>
          <span className={styles.composerHint} aria-hidden="true">
            {t('community.comments.shortcut')}
          </span>
          {onCancel ? (
            <Button type="button" size="small" variant="text" onClick={onCancel}>
              {t('common.actions.cancel')}
            </Button>
          ) : null}
          <Button type="submit" size="small" icon="send" loading={busy} disabled={!text.trim()}>
            {t('community.deck.send')}
          </Button>
        </span>
      </div>
    </form>
  )
}

function LikeButton({ comment, onToggle }) {
  const t = useT()
  return (
    <button
      type="button"
      className={styles.like}
      aria-pressed={comment.liked ? 'true' : 'false'}
      onClick={() => onToggle(comment)}
      aria-label={t('community.comments.like', {
        count: comment.likeCount,
        value: fmtNumber(comment.likeCount)
      })}
    >
      <Icon name="heart" size={14} />
      {comment.likeCount ? <span aria-hidden="true">{fmtNumber(comment.likeCount)}</span> : null}
    </button>
  )
}

function CommentItem({ comment, authorId, onLike, onReply, onReport, isReply }) {
  const t = useT()
  const isAuthor = authorId && comment.authorId === authorId
  return (
    <div className={styles.comment} data-reply={isReply ? 'true' : 'false'}>
      <Avatar name={comment.authorName} />
      <div className={styles.body}>
        <div className={styles.bubble} data-author={isAuthor ? 'true' : 'false'}>
          <span className={styles.head}>
            <span className={styles.name}>{comment.authorName}</span>
            {isAuthor ? <span className={styles.authorTag}>{t('community.comments.author')}</span> : null}
            {comment.isMine ? <span className={styles.mineTag}>{t('community.comments.you')}</span> : null}
          </span>
          <p className={styles.text}>{comment.text}</p>
        </div>
        <span className={styles.actions}>
          <time dateTime={comment.createdAt}>{fmtRelative(comment.createdAt)}</time>
          <LikeButton comment={comment} onToggle={onLike} />
          {onReply ? (
            <button type="button" className={styles.action} onClick={onReply}>
              {t('community.deck.reply')}
            </button>
          ) : null}
          {onReport && !comment.isMine ? (
            <button type="button" className={styles.action} onClick={() => onReport(comment)} aria-label={t('community.deck.reportComment')}>
              <Icon name="flag" size={13} />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
}

export function CommentsPanel({ basePath, authorId, limit, onCountChange, autoFocus, headingLevel = 2, title }) {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const headingId = useId()
  const [threads, setThreads] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [openReplies, setOpenReplies] = useState(() => new Set())

  const load = useCallback(
    () =>
      studentApi
        .get(`${basePath}/comments`)
        .then((d) => {
          setThreads(d.threads)
          onCountChange?.(d.total)
        })
        .catch(() => setThreads([])),
    [basePath]
  )

  useEffect(() => {
    setThreads(null)
    load()
  }, [load])

  const { send, busy } = useSendComment(basePath, load)

  const patch = (updated) =>
    setThreads((list) =>
      list.map((th) =>
        th.id === updated.id
          ? { ...th, likeCount: updated.likeCount, liked: updated.liked }
          : {
              ...th,
              replies: th.replies.map((r) => (r.id === updated.id ? { ...r, likeCount: updated.likeCount, liked: updated.liked } : r))
            }
      )
    )

  const like = async (comment) => {
    patch({
      id: comment.id,
      liked: !comment.liked,
      likeCount: comment.likeCount + (comment.liked ? -1 : 1)
    })
    try {
      patch(await studentApi.post(`/community/comments/${comment.id}/like`))
    } catch (err) {
      patch(comment)
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const report = async (comment) => {
    try {
      await studentApi.post(`/community/comments/${comment.id}/report`, {
        reason: 'Spam'
      })
      toast.show({
        message: t('community.deck.commentReported'),
        icon: 'flag'
      })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const total = threads ? threads.reduce((n, th) => n + 1 + th.replies.length, 0) : 0
  const visible = threads && limit && !expanded ? threads.slice(0, limit) : threads || []
  const hidden = threads ? threads.length - visible.length : 0
  const Heading = `h${headingLevel}`

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <Heading id={headingId} className={styles.panelTitle}>
          {title || t('community.deck.commentsTitle')}
          {threads ? <span className={styles.count}>{fmtNumber(total)}</span> : null}
        </Heading>
      </header>

      <Composer onSend={(text) => send(text)} busy={busy && !replyTo} placeholder={t('community.deck.commentPlaceholder')} autoFocus={autoFocus} />
      {!session.canEarn ? <p className={styles.note}>{t('community.deck.verifyToComment')}</p> : null}

      {threads === null ? <Skeleton height={56} count={2} /> : null}
      {threads?.length === 0 ? (
        <p className={styles.empty}>
          <Icon name="message" size={18} /> {t('community.deck.noComments')}
        </p>
      ) : null}

      <ul className={styles.threads}>
        {visible.map((th) => {
          const showAll = openReplies.has(th.id) || th.replies.length <= 2
          const replies = showAll ? th.replies : th.replies.slice(-1)
          return (
            <li key={th.id} className={styles.thread}>
              <CommentItem comment={th} authorId={authorId} onLike={like} onReport={report} onReply={() => setReplyTo(th)} />
              {th.replies.length ? (
                <div className={styles.replies}>
                  {!showAll ? (
                    <button type="button" className={styles.moreReplies} onClick={() => setOpenReplies((s) => new Set(s).add(th.id))}>
                      <Icon name="chevronDown" size={14} />{' '}
                      {t('community.comments.moreReplies', {
                        count: th.replies.length - 1
                      })}
                    </button>
                  ) : null}
                  {replies.map((r) => (
                    <CommentItem key={r.id} comment={r} authorId={authorId} onLike={like} onReport={report} onReply={() => setReplyTo(th)} isReply />
                  ))}
                </div>
              ) : null}
              {replyTo?.id === th.id ? (
                <div className={styles.replyComposer}>
                  <Composer
                    small
                    autoFocus
                    busy={busy}
                    placeholder={t('community.deck.replyPlaceholder', {
                      name: th.authorName
                    })}
                    onCancel={() => setReplyTo(null)}
                    onSend={async (text) => {
                      const ok = await send(text, th.id)
                      if (ok) {
                        setReplyTo(null)
                        setOpenReplies((s) => new Set(s).add(th.id))
                      }
                      return ok
                    }}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {hidden > 0 ? (
        <Button variant="soft" size="small" iconRight="chevronDown" onClick={() => setExpanded(true)}>
          {t('community.comments.showMore', { count: hidden })}
        </Button>
      ) : null}
    </section>
  )
}

export function CommentPreview({ preview, total, onOpen }) {
  const t = useT()
  if (!preview) {
    return (
      <button type="button" className={styles.firstPrompt} onClick={onOpen}>
        <Icon name="message" size={16} /> {t('community.comments.beFirst')}
      </button>
    )
  }
  return (
    <div className={styles.preview}>
      <button type="button" className={styles.previewOpen} onClick={onOpen}>
        <Avatar name={preview.authorName} />
        <span className={styles.previewBody}>
          <span className={styles.previewText}>
            <strong>{preview.authorName}</strong> {preview.text}
          </span>
          <span className={styles.previewMeta}>
            {preview.likeCount ? (
              <span className={styles.previewLikes}>
                <Icon name="heart" size={12} /> {fmtNumber(preview.likeCount)}
              </span>
            ) : null}
            {preview.replyCount ? <span>{t('community.comments.replies', { count: preview.replyCount })}</span> : null}
            <span className={styles.previewAll}>{total > 1 ? t('community.comments.seeAll', { count: total }) : t('community.comments.reply')}</span>
          </span>
        </span>
      </button>
    </div>
  )
}
