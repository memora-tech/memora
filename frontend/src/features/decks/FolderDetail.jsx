import { useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './decks.module.css'
import { Avatar, Badge, Banner, Button, Input, PageHeader, Sheet, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { useSession } from '../../state/SessionContext.jsx'
import { DeckCard } from './DecksLibrary.jsx'

export function FolderDetail() {
  const t = useT()
  const toast = useToast()
  const session = useSession()
  const { folderId } = useParams()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const library = useAsync(() => studentApi.get('/decks'), [folderId])
  const data = library.data
  const folder = data?.folders.find((f) => f.id === folderId)
  useDocumentTitle(folder?.name)

  const addMember = async () => {
    try {
      await studentApi.post(`/folders/${folderId}/members`, { name, contact })
      toast.show({ message: t('decks.folder.added'), icon: 'check' })
      setAddOpen(false)
      setName('')
      setContact('')
      library.run()
    } catch (err) {
      if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
      else toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const removeMember = async (memberId) => {
    try {
      await studentApi.del(`/folders/${folderId}/members/${memberId}`)
      toast.show({ message: t('decks.folder.removed') })
      library.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (library.loading && !data) return <Skeleton height={120} count={3} />
  if (!folder) return <Banner tone="danger" icon="alert">{t('decks.folder.notFound')}</Banner>

  const decks = [...data.decks.filter((d) => d.folderId === folder.id), ...data.favorites.filter((d) => d.folderId === folder.id)]

  return (
    <div className={styles.page}>
      <PageHeader title={folder.name} backTo="/app/decks" backLabel={t('decks.title')} actions={folder.shared ? <Badge tone="brand" icon="users">{t('decks.folder.shared')}</Badge> : <Badge>{t('decks.folder.notShared')}</Badge>}>
        {t('decks.folder.decksIn', { count: decks.length })}
      </PageHeader>

      <div className={styles.grid}>
        {decks.map((d) => (
          <DeckCard key={d.id} deck={d} to={d.favorite ? `/app/comunidade/deck/${d.id}` : `/app/decks/${d.id}`} />
        ))}
        {!decks.length ? <p className={styles.meta}>{t('decks.folder.empty')}</p> : null}
      </div>

      <Surface id="membros">
        <div className={styles.titleRow}>
          <h2 style={{ fontSize: 'var(--size-heading)' }}>{t('decks.folder.members')}</h2>
          <Button size="small" variant="soft" icon="plus" onClick={() => setAddOpen(true)} disabled={folder.members.length >= 50}>
            {t('decks.folder.addMember')}
          </Button>
        </div>
        <p className={styles.meta} style={{ marginTop: 8 }}>
          {t('decks.folder.limit', { count: folder.members.length })} · {t('decks.folder.onlyOwnerEdits')}
        </p>
        <p className={styles.meta}>{t('decks.folder.ownerNote')}</p>
        {session.isMinor ? <p className={styles.meta}>{t('decks.folder.minorNote')}</p> : null}
        <div style={{ marginTop: 12 }}>
          {folder.members.map((m) => (
            <div key={m.id} className={styles.memberRow}>
              <div className={styles.memberInfo}>
                <Avatar name={m.name} />
                <div>
                  <div className={styles.cardFront}>{m.name}</div>
                  <div className={styles.meta}>
                    {m.contact} · {t('decks.folder.since', { date: fmtDate(m.since) })}
                  </div>
                </div>
              </div>
              <Button size="small" variant="text" icon="x" label={`${t('common.actions.remove')} ${m.name}`} onClick={() => removeMember(m.id)} />
            </div>
          ))}
        </div>
      </Surface>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('decks.folder.addMember')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={addMember} disabled={!contact.trim()}>
              {t('common.actions.add')}
            </Button>
          </>
        }
      >
        <Input label={t('decks.folder.memberName')} value={name} onChange={(e) => setName(e.target.value)} optional />
        <Input label={t('decks.folder.memberContact')} value={contact} onChange={(e) => setContact(e.target.value)} inputMode="email" autoFocus />
      </Sheet>
    </div>
  )
}
