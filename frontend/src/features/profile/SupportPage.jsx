import { useState } from 'react'
import styles from './profile.module.css'
import { Badge, Banner, Button, EmptyState, Input, PageHeader, Sheet, Skeleton, Surface, Textarea, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'

export function SupportPage() {
  const t = useT()
  const toast = useToast()
  const tickets = useAsync(() => studentApi.get('/support/tickets'), [])
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState({})
  const [busy, setBusy] = useState(false)
  useDocumentTitle(t('profile.support.title'))

  const create = async () => {
    setBusy(true)
    try {
      await studentApi.post('/support/tickets', { subject, message, channel: 'chat' })
      toast.show({ message: t('profile.support.sent'), icon: 'check' })
      setOpen(false)
      setSubject('')
      setMessage('')
      tickets.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async (id) => {
    const text = reply[id]
    if (!text?.trim()) return
    try {
      await studentApi.post(`/support/tickets/${id}/messages`, { text })
      setReply((r) => ({ ...r, [id]: '' }))
      tickets.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const list = tickets.data?.tickets || []

  return (
    <div className={styles.page}>
      <PageHeader title={t('profile.support.title')} backTo="/app/perfil" backLabel={t('profile.title')} actions={<Button size="small" icon="message" label={t('profile.support.new')} onClick={() => setOpen(true)} />}>
        {tickets.data?.sla || t('profile.support.intro')}
      </PageHeader>

      {tickets.loading && !tickets.data ? <Skeleton height={100} count={2} /> : null}
      {tickets.error && !tickets.data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => tickets.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {tickets.data && !list.length ? (
        <Surface>
          <EmptyState icon="message" title={t('profile.support.empty')} action={<Button icon="message" onClick={() => setOpen(true)}>{t('profile.support.new')}</Button>} />
        </Surface>
      ) : null}
      {list.map((tk) => (
        <Surface key={tk.id} className={styles.ticket}>
          <div className={styles.sectionTitle}>
            <span>{tk.subject}</span>
            <Badge tone={tk.status === 'resolvido' ? 'success' : tk.status === 'respondido' ? 'brand' : 'warning'}>{t(`profile.support.status.${tk.status}`)}</Badge>
          </div>
          <span className={styles.meta}>{fmtDateTime(tk.createdAt)}</span>
          <div className={[styles.bubble, styles.bubbleMine].join(' ')}>{tk.message}</div>
          {tk.replies.map((r, i) => (
            <div key={i} className={[styles.bubble, r.mine && styles.bubbleMine].filter(Boolean).join(' ')}>
              <strong>{r.mine ? t('profile.support.you') : r.by}</strong>
              <br />
              {r.text}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Textarea aria-label={t('profile.support.yourMessage')} placeholder={t('profile.support.yourMessage')} rows={2} value={reply[tk.id] || ''} onChange={(e) => setReply((r) => ({ ...r, [tk.id]: e.target.value }))} style={{ minHeight: 56 }} />
            </div>
            <Button icon="send" label={t('profile.support.reply')} onClick={() => sendReply(tk.id)} disabled={!reply[tk.id]?.trim()} />
          </div>
        </Surface>
      ))}

      <p className={styles.meta}>{t('profile.support.viewAsNote')}</p>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('profile.support.new')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button loading={busy} disabled={!subject.trim() || !message.trim()} onClick={create}>
              {t('profile.support.send')}
            </Button>
          </>
        }
      >
        <Input label={t('profile.support.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        <Textarea label={t('profile.support.message')} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
      </Sheet>
    </div>
  )
}
