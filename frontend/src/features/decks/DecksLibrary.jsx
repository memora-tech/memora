import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './decks.module.css'
import { Badge, Banner, Button, Chip, EmptyState, Icon, Input, Sheet, Skeleton, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'

const CACHE_KEY = 'memora.cache.decks'

export function DeckCard({ deck, to, onClick }) {
  const t = useT()
  const pub = deck.publication?.status
  return (
    <Surface interactive to={to} onClick={onClick} className={styles.deckCard} aria-label={deck.name}>
      <div className={styles.deckTop}>
        <span className={styles.deckName}>{deck.name}</span>
        {deck.progress?.offlineAvailable ? <Badge tone="brand" icon="download">{deck.progress.offlineReason === 'fixado' ? t('decks.pinned') : t('decks.offline')}</Badge> : null}
      </div>
      <div className={styles.deckMeta}>
        <span>{deck.categoryName}</span>
        <span>·</span>
        <span>{t('common.difficulty.' + deck.difficulty)}</span>
        <span>·</span>
        <span>{t('decks.total', { count: deck.cardCount ?? deck.progress?.total ?? 0 })}</span>
        {deck.author ? <span>· {t('decks.by', { author: deck.author.name })}</span> : null}
      </div>
      <div className={styles.chips}>
        {deck.progress?.due ? <Chip tone="brand">{t('decks.due', { count: deck.progress.due })}</Chip> : null}
        {deck.difficult ? <Chip tone="warning" icon="zap">{t('study.home.planTags.difficult')}</Chip> : null}
        {deck.focus ? <Chip tone="brand" icon="target">{t('study.home.planTags.focus')}</Chip> : null}
        {deck.complementary ? <Chip tone="neutral">{t('study.home.planTags.complementary')}</Chip> : null}
        {pub && pub !== 'nao_publicado' ? <Chip tone={pub === 'aprovado' ? 'success' : pub === 'rejeitado' ? 'danger' : 'neutral'} icon={pub === 'aprovado' ? 'globe' : 'clock'}>{t(`decks.publication.${pub}`)}</Chip> : null}
        {deck.favorite ? <Chip tone="reward" icon="heart">{t('decks.favorites')}</Chip> : null}
      </div>
    </Surface>
  )
}

export function DecksLibrary() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [newFolder, setNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  useDocumentTitle(t('decks.title'))

  const library = useAsync(async () => {
    try {
      const data = await studentApi.get('/decks')
      storage.set(CACHE_KEY, data)
      return data
    } catch (err) {
      const cached = storage.get(CACHE_KEY)
      if (cached && err.status === 0) return { ...cached, cached: true }
      throw err
    }
  }, [])

  const data = library.data
  const filter = (list) => list.filter((d) => !q || `${d.name} ${d.categoryName} ${(d.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const rootDecks = useMemo(() => filter((data?.decks || []).filter((d) => !d.folderId)), [data, q])
  const favorites = useMemo(() => filter((data?.favorites || []).filter((d) => !d.folderId)), [data, q])
  const folders = useMemo(() => (data?.folders || []).filter((f) => !f.parentId && (!q || f.name.toLowerCase().includes(q.toLowerCase()))), [data, q])

  const createFolder = async () => {
    if (!folderName.trim()) return
    try {
      await studentApi.post('/folders', { name: folderName.trim() })
      toast.show({ message: t('decks.folderCreated'), icon: 'check' })
      setNewFolder(false)
      setFolderName('')
      library.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t('decks.title')}</h1>
        <Button variant="soft" size="small" icon="folder" onClick={() => setNewFolder(true)}>
          {t('decks.newFolder')}
        </Button>
      </div>
      <Input label={t('decks.search')} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('decks.searchPlaceholder')} />

      {library.loading && !data ? <Skeleton height={96} count={3} /> : null}
      {library.error && !data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => library.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {data?.cached ? (
        <Banner tone="neutral" icon="wifiOff">
          {t('common.state.offline')}
        </Banner>
      ) : null}

      {data && !data.decks.length && !data.favorites.length ? (
        <Surface>
          <EmptyState icon="folder" title={t('decks.empty')} text={t('decks.emptyText')} action={<Button icon="plus" to="/app/criar">{t('common.nav.create')}</Button>} />
        </Surface>
      ) : null}

      {folders.length ? (
        <section className={styles.section} aria-labelledby="sec-pastas">
          <h2 id="sec-pastas" style={{ fontSize: 'var(--size-heading)' }}>
            {t('decks.folders')}
          </h2>
          <div className={styles.grid}>
            {folders.map((f) => (
              <Surface key={f.id} interactive to={`/app/pastas/${f.id}`} className={styles.folderCard}>
                <span className={styles.folderIcon}>
                  <Icon name="folder" size={22} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className={styles.deckName}>{f.name}</span>
                  <div className={styles.deckMeta}>
                    <span>{t('decks.folder.decksIn', { count: f.deckIds.length })}</span>
                    {f.shared ? <Badge tone="brand" icon="users">{t('decks.folder.shared')}</Badge> : null}
                  </div>
                </span>
                <Icon name="chevronRight" />
              </Surface>
            ))}
          </div>
        </section>
      ) : null}

      {rootDecks.length ? (
        <section className={styles.section} aria-labelledby="sec-decks">
          <h2 id="sec-decks" style={{ fontSize: 'var(--size-heading)' }}>
            {t('decks.decks')}
          </h2>
          <div className={styles.grid}>
            {rootDecks.map((d) => (
              <DeckCard key={d.id} deck={d} to={`/app/decks/${d.id}`} />
            ))}
          </div>
        </section>
      ) : null}

      {favorites.length ? (
        <section className={styles.section} aria-labelledby="sec-fav">
          <h2 id="sec-fav" style={{ fontSize: 'var(--size-heading)' }}>
            {t('decks.favorites')}
          </h2>
          <div className={styles.grid}>
            {favorites.map((d) => (
              <DeckCard key={d.id} deck={d} to={`/app/comunidade/deck/${d.id}`} />
            ))}
          </div>
        </section>
      ) : null}

      {data && q && !rootDecks.length && !favorites.length && !folders.length ? <p className={styles.meta}>{t('decks.noResults', { q })}</p> : null}

      <Sheet
        open={newFolder}
        onClose={() => setNewFolder(false)}
        title={t('decks.newFolder')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewFolder(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={createFolder} disabled={!folderName.trim()}>
              {t('common.actions.save')}
            </Button>
          </>
        }
      >
        <Input label={t('decks.folderName')} hint={t('decks.folderDepth')} value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
      </Sheet>
    </div>
  )
}
