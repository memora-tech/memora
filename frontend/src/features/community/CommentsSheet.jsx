import { useEffect, useState } from 'react'
import styles from './community.module.css'
import { Avatar, Button, Sheet, Skeleton, Textarea, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { studentApi } from '../../lib/api.js'
import { fmtRelative } from '../../lib/format.js'
import { useSession } from '../../state/SessionContext.jsx'

export function CommentsSheet({ open, onClose, deckId, onChanged }) {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const [threads, setThreads] = useState(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [busy, setBusy] = useState(false)

  const startReply = (thread) => {
    setReplyTo(thread)
    requestAnimationFrame(() => document.getElementById('comment-field')?.focus())
  }

  const load = () =>
    studentApi
      .get(`/community/decks/${deckId}/comments`)
      .then((d) => setThreads(d.threads))
      .catch(() => setThreads([]))

  useEffect(() => {
    if (open) {
      setThreads(null)
      setText('')
      setReplyTo(null)
      load()
    }
  }, [open, deckId])

  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await studentApi.post(`/community/decks/${deckId}/comments`, { text, parentId: replyTo?.id || null })
      toast.show({ message: t('community.deck.commentSent'), icon: 'check' })
      setText('')
      setReplyTo(null)
      await load()
      onChanged?.()
    } catch (err) {
      if (err.code === 'verification_required') toast.show({ message: t('community.deck.verifyToComment'), tone: 'danger' })
      else if (err.code === 'guardian_required') toast.show({ message: `${t('community.deck.guardianToComment')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
      else toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const reportComment = async (id) => {
    try {
      await studentApi.post(`/community/comments/${id}/report`, { reason: 'Spam' })
      toast.show({ message: t('community.deck.commentReported'), icon: 'flag' })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('community.deck.commentsTitle')}
      footer={
        <div className={styles.composerWrap}>
          {replyTo ? (
            <span className={styles.replyTo}>
              <span className={styles.replyToName}>{t('community.deck.replyingTo', { name: replyTo.authorName })}</span>
              <Button variant="text" size="small" icon="x" label={t('community.deck.cancelReply')} onClick={() => setReplyTo(null)} />
            </span>
          ) : null}
          <div className={styles.composer}>
            <Textarea id="comment-field" aria-label={replyTo ? t('community.deck.replyPlaceholder', { name: replyTo.authorName }) : t('community.deck.commentPlaceholder')} placeholder={replyTo ? t('community.deck.replyPlaceholder', { name: replyTo.authorName }) : t('community.deck.commentPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ minHeight: 56 }} />
            <Button icon="send" label={t('community.deck.send')} onClick={send} loading={busy} disabled={!text.trim()} />
          </div>
        </div>
      }
    >
      {!session.canEarn ? <p className={styles.meta}>{t('community.deck.verifyToComment')}</p> : null}
      {threads === null ? <Skeleton height={64} count={3} /> : null}
      {threads?.length === 0 ? <p className={styles.meta}>{t('community.deck.noComments')}</p> : null}
      {threads?.map((th) => (
        <div key={th.id} className={styles.thread}>
          <div className={styles.comment}>
            <Avatar name={th.authorName} />
            <div className={styles.commentBody}>
              <span className={styles.commentAuthor}>
                {th.authorName} <span className={styles.meta}>{fmtRelative(th.createdAt)}</span>
              </span>
              <span className={styles.commentText}>{th.text}</span>
              <div className={styles.commentActions}>
                <Button size="small" variant="text" onClick={() => startReply(th)}>
                  {t('community.deck.reply')}
                </Button>
                <Button size="small" variant="text" icon="flag" label={t('community.deck.reportComment')} onClick={() => reportComment(th.id)} />
              </div>
            </div>
          </div>
          {th.replies.length ? (
            <div className={styles.replies}>
              {th.replies.map((r) => (
                <div key={r.id} className={styles.comment}>
                  <Avatar name={r.authorName} />
                  <div className={styles.commentBody}>
                    <span className={styles.commentAuthor}>
                      {r.authorName} <span className={styles.meta}>{fmtRelative(r.createdAt)}</span>
                    </span>
                    <span className={styles.commentText}>{r.text}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </Sheet>
  )
}
