import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './decks.module.css'
import { Badge, Banner, Button, Chip, EmptyState, Icon, Input, Panel, Screen, ScreenHeader, Segmented, Sheet, Skeleton, StatRow, StatTile, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'

const CACHE_KEY = 'memora.cache.decks'

function DeckChips({ deck }) {
  const t = useT()
  const pub = deck.publication?.status
  return (
    <div className={styles.chips}>
      {deck.progress?.due ? <Chip tone="brand">{t('decks.due', { count: deck.progress.due })}</Chip> : null}
      {deck.difficult ? <Chip tone="warning" icon="zap">{t('study.home.planTags.difficult')}</Chip> : null}
      {deck.focus ? <Chip tone="brand" icon="target">{t('study.home.planTags.focus')}</Chip> : null}
      {deck.complementary ? <Chip tone="neutral">{t('study.home.planTags.complementary')}</Chip> : null}
      {pub && pub !== 'nao_publicado' ? <Chip tone={pub === 'aprovado' ? 'success' : pub === 'rejeitado' ? 'danger' : 'neutral'} icon={pub === 'aprovado' ? 'globe' : 'clock'}>{t(`decks.publication.${pub}`)}</Chip> : null}
      {deck.favorite ? <Chip tone="reward" icon="heart">{t('decks.favorites')}</Chip> : null}
    </div>
  )
}

function DeckMeta({ deck, folderName }) {
  const t = useT()
  return (
    <div className={styles.deckMeta}>
      <span>{deck.categoryName}</span>
      <span aria-hidden="true">·</span>
      <span>{t('common.difficulty.' + deck.difficulty)}</span>
      <span aria-hidden="true">·</span>
      <span>{t('decks.total', { count: deck.cardCount ?? deck.progress?.total ?? 0 })}</span>
      {deck.author ? <span>· {t('decks.by', { author: deck.author.name })}</span> : null}
      {folderName ? (
        <span className={styles.folderTag}>
          <Icon name="folder" size={13} /> {folderName}
        </span>
      ) : null}
    </div>
  )
}

export function DeckCard({ deck, to, onClick }) {
  const t = useT()
  return (
    <Surface interactive to={to} onClick={onClick} className={styles.deckCard} aria-label={deck.name}>
      <div className={styles.deckTop}>
        <span className={styles.deckName}>{deck.name}</span>
        {deck.progress?.offlineAvailable ? <Badge tone="brand" icon="download">{deck.progress.offlineReason === 'fixado' ? t('decks.pinned') : t('decks.offline')}</Badge> : null}
      </div>
      <DeckMeta deck={deck} />
      <DeckChips deck={deck} />
    </Surface>
  )
}

function ScheduleCard({ deck, folderName, onToggle, busy }) {
  const t = useT()
  const total = deck.progress?.total || 0
  const mastered = deck.progress?.mastered || 0
  return (
    <article className={styles.planCard} data-scheduled={deck.scheduled ? 'true' : 'false'}>
      <Link to={`/app/decks/${deck.id}`} className={styles.planCardLink}>
        <span className={styles.deckTop}>
          <span className={styles.deckName}>{deck.name}</span>
          {deck.progress?.offlineAvailable ? <Badge tone="brand" icon="download">{deck.progress.offlineReason === 'fixado' ? t('decks.pinned') : t('decks.offline')}</Badge> : null}
        </span>
        <DeckMeta deck={deck} folderName={folderName} />
        <span className={styles.mastery}>
          <span className={styles.masteryBar} aria-hidden="true">
            <span style={{ width: `${total ? Math.round((mastered / total) * 100) : 0}%` }} />
          </span>
          <span className={styles.masteryText}>{t('decks.schedule.mastered', { mastered, total })}</span>
        </span>
        <DeckChips deck={deck} />
      </Link>
      <div className={styles.planCardFoot}>
        <button type="button" className={styles.scheduleToggle} aria-pressed={deck.scheduled ? 'true' : 'false'} onClick={() => onToggle(deck)} disabled={busy}>
          <Icon name={deck.scheduled ? 'check' : 'plus'} size={18} />
          {deck.scheduled ? t('decks.schedule.on') : t('decks.schedule.off')}
        </button>
      </div>
    </article>
  )
}

export function DecksLibrary() {
  const t = useT()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [view, setView] = useState('all')
  const [busyId, setBusyId] = useState(null)
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
  const own = data?.decks || []
  const folderById = useMemo(() => Object.fromEntries((data?.folders || []).map((f) => [f.id, f.name])), [data])
  const match = (d) => !q || `${d.name} ${d.categoryName} ${(d.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const scheduledCount = own.filter((d) => d.scheduled).length
  const dueScheduled = own.filter((d) => d.scheduled).reduce((n, d) => n + (d.progress?.due || 0), 0)
  const shown = own.filter(match).filter((d) => (view === 'scheduled' ? d.scheduled : view === 'unscheduled' ? !d.scheduled : true)).sort((a, b) => Number(b.scheduled) - Number(a.scheduled))
  const favorites = (data?.favorites || []).filter(match)
  const folders = (data?.folders || []).filter((f) => !f.parentId)

  const toggle = async (deck) => {
    setBusyId(deck.id)
    try {
      const res = await studentApi.patch(`/decks/${deck.id}`, { scheduled: !deck.scheduled })
      library.setData({ ...data, decks: own.map((d) => (d.id === deck.id ? { ...d, ...res.deck } : d)) })
      toast.show({ message: res.deck.scheduled ? t('decks.schedule.added', { name: deck.name }) : t('decks.schedule.removed', { name: deck.name }), icon: res.deck.scheduled ? 'check' : 'minus' })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

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
    <Screen>
      <ScreenHeader
        eyebrow={t('decks.eyebrow')}
        title={t('decks.title')}
        lead={t('decks.lead')}
        actions={
          <>
            <Button variant="ghost" icon="folder" onClick={() => setNewFolder(true)}>
              {t('decks.newFolder')}
            </Button>
            <Button icon="plus" to="/app/criar">
              {t('common.nav.create')}
            </Button>
          </>
        }
      />

      {data ? (
        <StatRow>
          <StatTile icon="layers" label={t('decks.stats.decks')} value={own.length} note={t('decks.stats.favorites', { count: data.favorites.length })} />
          <StatTile icon="calendar" tone="ink" label={t('decks.stats.scheduled')} value={scheduledCount} note={t('decks.stats.scheduledNote', { count: own.length - scheduledCount })} />
          <StatTile icon="refresh" label={t('decks.stats.due')} value={dueScheduled} note={t('decks.stats.dueNote')} />
          <StatTile icon="folder" label={t('decks.stats.folders')} value={folders.length} />
        </StatRow>
      ) : null}

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

      {data && !own.length && !data.favorites.length ? (
        <Surface>
          <EmptyState icon="folder" title={t('decks.empty')} text={t('decks.emptyText')} action={<Button icon="plus" to="/app/criar">{t('common.nav.create')}</Button>} />
        </Surface>
      ) : null}

      {data && (own.length || data.favorites.length) ? (
        <div className={styles.libraryLayout}>
          <div className={styles.libraryMain}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarSearch}>
                <Input aria-label={t('decks.search')} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('decks.searchPlaceholder')} />
              </div>
              <Segmented
                label={t('decks.schedule.filter')}
                value={view}
                onChange={setView}
                options={[
                  { value: 'all', label: t('decks.schedule.all', { count: own.length }) },
                  { value: 'scheduled', label: t('decks.schedule.scheduled', { count: scheduledCount }) },
                  { value: 'unscheduled', label: t('decks.schedule.unscheduled', { count: own.length - scheduledCount }) }
                ]}
              />
            </div>

            <Banner tone="brand" icon="calendar" action={<Button size="small" variant="soft" to="/app">{t('decks.schedule.goStudy')}</Button>}>
              {t('decks.schedule.hint', { count: scheduledCount, due: dueScheduled })}
            </Banner>

            <section className={styles.section} aria-labelledby="sec-decks">
              <h2 id="sec-decks" className={styles.sectionTitle}>
                {t('decks.decks')}
              </h2>
              {shown.length ? (
                <div className={styles.grid}>
                  {shown.map((d) => (
                    <ScheduleCard key={d.id} deck={d} folderName={folderById[d.folderId]} onToggle={toggle} busy={busyId === d.id} />
                  ))}
                </div>
              ) : (
                <p className={styles.meta}>{q ? t('decks.noResults', { q }) : t('decks.schedule.emptyView')}</p>
              )}
            </section>

            {favorites.length ? (
              <section className={styles.section} aria-labelledby="sec-fav">
                <h2 id="sec-fav" className={styles.sectionTitle}>
                  {t('decks.favorites')}
                </h2>
                <div className={styles.grid}>
                  {favorites.map((d) => (
                    <DeckCard key={d.id} deck={d} to={`/app/comunidade/deck/${d.id}`} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <Panel title={t('decks.folders')} icon="folder" labelledBy="sec-pastas" className={styles.folderPanel} action={<Button size="small" variant="text" icon="plus" onClick={() => setNewFolder(true)} label={t('decks.newFolder')} />}>
            {folders.length ? (
              <ul className={styles.folderList}>
                {folders.map((f) => (
                  <li key={f.id}>
                    <Link to={`/app/pastas/${f.id}`} className={styles.folderRow}>
                      <span className={styles.folderIcon}>
                        <Icon name="folder" size={20} />
                      </span>
                      <span className={styles.folderText}>
                        <span className={styles.folderName}>{f.name}</span>
                        <span className={styles.meta}>
                          {t('decks.folder.decksIn', { count: f.deckIds.length })}
                          {f.shared ? ` · ${t('decks.folder.shared')}` : ''}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.meta}>{t('decks.schedule.noFolders')}</p>
            )}
          </Panel>
        </div>
      ) : null}

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
    </Screen>
  )
}
