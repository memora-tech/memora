import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './decks.module.css'
import { Badge, Banner, Button, Chip, OverflowMenu, PageHeader, ProgressBar, Sheet, Skeleton, Stat, Surface, Textarea, Toggle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtDate, fmtRelative } from '../../lib/format.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useSession } from '../../state/SessionContext.jsx'
import { PublishSheet } from './PublishSheet.jsx'

export function DeckDetail() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const study = useStudy()
  const session = useSession()
  const { deckId } = useParams()
  const [editing, setEditing] = useState(null)
  const [exportResult, setExportResult] = useState(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [appealOpen, setAppealOpen] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [showAllCards, setShowAllCards] = useState(false)
  const detail = useAsync(() => studentApi.get(`/decks/${deckId}`), [deckId])
  const library = useAsync(() => studentApi.get('/decks'), [deckId])
  const data = detail.data
  const deck = data?.deck
  useDocumentTitle(deck?.name)

  const patch = async (body, message) => {
    try {
      await studentApi.patch(`/decks/${deckId}`, body)
      toast.show({ message: message || t('decks.detail.updated'), icon: 'check' })
      detail.run()
      library.run()
      study.loadToday()
    } catch (err) {
      toast.show({ message: err.code === 'pin_limit' ? t('decks.detail.pinLimit', { limit: err.body.limit }) : err.message, tone: 'danger' })
    }
  }

  const startStudy = () => {
    const due = data.cards.filter((c) => !c.sched?.due || new Date(c.sched.due).getTime() <= Date.now())
    const cards = (due.length ? due : data.cards).map((c) => ({ ...c, deckName: deck.name }))
    if (study.start({ mode: 'deck', deckId: deck.id, deckName: deck.name, cards })) navigate('/app/estudar')
  }

  const saveCard = async () => {
    try {
      await studentApi.patch(`/decks/${deckId}/cards/${editing.id}`, { front: editing.front, back: editing.back })
      toast.show({ message: t('decks.detail.cardSaved'), icon: 'check' })
      setEditing(null)
      detail.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const deleteCard = async (card) => {
    try {
      await studentApi.del(`/decks/${deckId}/cards/${card.id}`)
      toast.show({ message: t('decks.detail.cardDeleted'), icon: 'trash' })
      setEditing(null)
      detail.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const shareFolder = async () => {
    if (deck.folderId) {
      navigate(`/app/pastas/${deck.folderId}`)
      return
    }
    try {
      const { folder } = await studentApi.post('/folders', { name: deck.name })
      await studentApi.patch(`/decks/${deckId}`, { folderId: folder.id })
      navigate(`/app/pastas/${folder.id}`)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const doExport = async (format) => {
    try {
      const result = await studentApi.post(`/decks/${deckId}/export`, { format })
      setExportResult(result)
      toast.show({ message: t('decks.export.ready', { file: result.fileName }), icon: 'download', action: { label: t('common.actions.open'), onClick: () => window.open(result.url, '_blank', 'noopener') }, duration: 6000 })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const sendAppeal = async () => {
    try {
      await studentApi.post(`/publications/${pub.id}/appeal`, { text: appealText })
      toast.show({ message: t('decks.publish.appealSent'), icon: 'check', duration: 6000 })
      setAppealOpen(false)
      setAppealText('')
      detail.run()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/d/${deck.publication.publicId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.show({ message: t('decks.publish.linkCopied'), icon: 'copy' })
    } catch {
      toast.show({ message: url })
    }
  }

  if (detail.loading && !data) return <Skeleton height={120} count={3} />
  if (detail.error && !data) {
    return (
      <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => detail.run()}>{t('common.actions.retry')}</Button>}>
        {detail.error.status === 404 ? t('decks.detail.notFound') : t('common.state.error')}
      </Banner>
    )
  }
  if (!deck) return null

  const p = deck.progress
  const pub = data.publication
  const pubStatus = deck.publication?.status || 'nao_publicado'
  const limits = library.data?.limits
  const menuItems = [
    { key: 'difficult', icon: 'zap', label: deck.difficult ? t('decks.detail.menu.undifficult') : t('decks.detail.menu.difficult'), active: deck.difficult, onSelect: () => patch({ difficult: !deck.difficult }) },
    { key: 'focus', icon: 'target', label: deck.focus ? t('decks.detail.menu.unfocus') : t('decks.detail.menu.focus'), active: deck.focus, onSelect: () => patch({ focus: !deck.focus }) },
    { key: 'complementary', icon: 'layers', label: deck.complementary ? t('decks.detail.menu.uncomplementary') : t('decks.detail.menu.complementary'), active: deck.complementary, onSelect: () => patch({ complementary: !deck.complementary }) },
    { key: 'share', icon: 'users', label: t('decks.detail.menu.shareFolder'), onSelect: shareFolder },
    { key: 'export', icon: 'download', label: t('decks.detail.menu.export'), onSelect: () => doExport('pdf') },
    { key: 'publish', icon: 'globe', label: pubStatus === 'aprovado' ? t('decks.detail.menu.publishVersion') : t('decks.detail.menu.publish'), disabled: ['em_triagem', 'em_revisao'].includes(pubStatus) || Boolean(deck.publication?.pendingVersion), onSelect: () => setPublishOpen(true) }
  ]

  return (
    <div className={styles.page}>
      <PageHeader title={deck.name} actions={<OverflowMenu items={menuItems} label={t('common.actions.more')} />} />

      <div className={styles.header}>
        <div className={styles.chips}>
          <Chip tone="brand">{deck.categoryName}</Chip>
          <Chip tone="neutral">{t(`common.difficulty.${deck.difficulty}`)}</Chip>
          {deck.tags?.slice(0, 2).map((tag) => (
            <Chip key={tag} tone="neutral" icon="tag">
              {tag}
            </Chip>
          ))}
          {deck.tags?.length > 2 ? <Chip tone="neutral">{t('decks.detail.moreTags', { count: deck.tags.length - 2 })}</Chip> : null}
          {deck.difficult ? <Chip tone="warning" icon="zap">{t('decks.detail.difficultOn')}</Chip> : null}
          {deck.focus ? <Chip tone="brand" icon="target">{t('decks.detail.focusOn')}</Chip> : null}
          {deck.complementary ? <Chip tone="neutral">{t('decks.detail.complementaryOn')}</Chip> : null}
        </div>
      </div>

      <Surface className={styles.stack}>
        <div className={styles.progressStats}>
          <Stat value={p.due} label={t('decks.detail.statDue')} />
          <Stat value={p.mastered} label={t('decks.detail.statMastered')} />
          <Stat value={p.total} label={t('decks.detail.statTotal')} />
        </div>
        <ProgressBar value={p.mastered} max={p.total || 1} label={t('decks.detail.progress', { due: p.due, mastered: p.mastered, total: p.total })} />
        <Button size="large" block icon="play" onClick={startStudy} disabled={!data.cards.length}>
          {p.due ? t('decks.detail.study') : t('decks.detail.studyAll')}
        </Button>
        {!p.due ? <span className={styles.meta}>{t('decks.detail.nothingDue')}</span> : null}
        <div className={styles.divider} />
        <Toggle
          checked={deck.pinned}
          onChange={(v) => patch({ pinned: v })}
          label={t('decks.detail.pinLabel')}
          help={limits ? t('decks.detail.pinCount', { pinned: limits.pinned, limit: limits.pinLimit }) : undefined}
        />
      </Surface>

      {exportResult ? (
        <Banner tone="success" icon="download" action={<Button size="small" href={exportResult.url} download={exportResult.fileName}>{t('common.actions.open')}</Button>}>
          {t('decks.export.ready', { file: exportResult.fileName })}
        </Banner>
      ) : null}

      {pubStatus !== 'nao_publicado' || deck.publication?.lastRejection ? (
        <Surface tone={pubStatus === 'aprovado' ? 'brand' : undefined}>
          <div className={styles.stack}>
            {pubStatus === 'aprovado' ? (
              <>
                <div className={styles.titleRow}>
                  <strong>{t('decks.publish.statusApproved', { version: deck.publication.version })}</strong>
                  <Badge tone="success" icon="globe">{t('decks.publication.aprovado')}</Badge>
                </div>
                {deck.publication.pendingVersion ? <Chip tone="neutral" icon="clock">{t('decks.publish.pendingVersion', { version: deck.publication.pendingVersion })}</Chip> : null}
                <div className={styles.actions}>
                  <span className={`${styles.meta} tabnum`}>{`${window.location.origin}/d/${deck.publication.publicId}`}</span>
                  <Button size="small" variant="soft" icon="copy" onClick={copyLink}>
                    {t('decks.publish.copyLink')}
                  </Button>
                </div>
              </>
            ) : null}
            {pub && ['em_triagem', 'em_revisao'].includes(pub.status) ? (
              <>
                <strong>{pub.status === 'em_triagem' ? t('decks.publish.statusQueue', { hours: pub.slaHours, when: fmtRelative(pub.submittedAt) }) : t('decks.publish.statusReview', { hours: pub.slaHours })}</strong>
                <span className={styles.meta}>{t('decks.publish.queued', { hours: pub.slaHours })}</span>
              </>
            ) : null}
            {pubStatus === 'rejeitado' || deck.publication?.lastRejection ? (
              <>
                <strong>{t('decks.publish.statusRejected', { category: t(`decks.publish.categories.${deck.publication.lastRejection?.reasonCategory || pub?.decision?.reasonCategory}`) })}</strong>
                <span className={styles.meta}>{t('decks.publish.excerpt', { excerpt: deck.publication.lastRejection?.excerpt || pub?.decision?.excerpt })}</span>
                <span className={styles.meta}>{t('decks.publish.appeal', { date: fmtDate(deck.publication.lastRejection?.appealDeadline || pub?.decision?.appealDeadline) })}</span>
                {pub?.appealId ? (
                  <Badge tone="warning">{t('decks.publish.appealPending')}</Badge>
                ) : (
                  <Button size="small" variant="soft" onClick={() => setAppealOpen(true)} disabled={!pub}>
                    {t('decks.publish.appealAction')}
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </Surface>
      ) : null}

      <p className={styles.meta}>
        {deck.source?.document ? t('decks.detail.source', { document: deck.source.document }) : null}
        {deck.source?.deleteOriginalAt ? ` · ${deck.source.keepOriginal ? t('decks.detail.keepOriginal') : t('decks.detail.deleteOriginal', { date: fmtDate(deck.source.deleteOriginalAt) })}` : ''}
      </p>
      {deck.clonedFrom ? (
        <Banner tone="neutral" icon="copy">
          {t('decks.detail.clonedFrom', { author: deck.clonedFrom.authorName, version: deck.clonedFrom.version })}
        </Banner>
      ) : null}
      {data.folder ? <p className={styles.meta}>{t('decks.folder.inFolder', { name: data.folder.name })}</p> : null}

      <div className={styles.titleRow}>
        <h2 style={{ fontSize: 'var(--size-heading)' }}>
          {t('decks.detail.cards')} · {data.cards.length}
        </h2>
        <Button size="small" variant="text" icon="plus" onClick={() => setEditing({ isNew: true, front: '', back: '' })}>
          {t('decks.detail.addCard')}
        </Button>
      </div>
      <div className={styles.cardList}>
        {(showAllCards ? data.cards : data.cards.slice(0, 5)).map((card) => (
          <Surface key={card.id} interactive onClick={() => setEditing({ ...card })} className={styles.cardItem} aria-label={`${card.front}. ${t('decks.detail.editCard')}`}>
            <span className={styles.cardFront}>{card.front}</span>
            <span className={styles.cardBack}>{card.back}</span>
            <span className={styles.cardMeta}>
              {card.type !== 'text' ? <Badge tone="brand" icon={card.type === 'image' ? 'image' : 'volume'}>{t(`decks.detail.cardTypes.${card.type}`)}</Badge> : null}
              {card.uncertain ? <Badge tone="warning" icon="alert">{t('create.review.uncertain')}</Badge> : null}
              {(card.sched?.stability || 0) >= 21 ? <Badge tone="success">{t('decks.detail.mastered')}</Badge> : null}
              {card.sched?.lapses ? <span>{t('decks.detail.lapses', { count: card.sched.lapses })}</span> : null}
              {card.sched?.due ? <span>{t('decks.detail.schedule', { when: fmtRelative(card.sched.due) })}</span> : null}
            </span>
          </Surface>
        ))}
      </div>
      {data.cards.length > 5 ? (
        <div className={styles.sectionFooter}>
          <Button variant="ghost" size="small" iconRight={showAllCards ? 'chevronUp' : 'chevronDown'} onClick={() => setShowAllCards((v) => !v)}>
            {showAllCards ? t('decks.detail.showLessCards') : t('decks.detail.showAllCards')}
          </Button>
        </div>
      ) : null}

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? t('decks.detail.addCard') : t('decks.detail.editCard')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              icon="check"
              disabled={!editing?.front?.trim() || !editing?.back?.trim()}
              onClick={async () => {
                if (editing.isNew) {
                  try {
                    await studentApi.post(`/decks/${deckId}/cards`, { front: editing.front, back: editing.back })
                    toast.show({ message: t('decks.detail.cardAdded'), icon: 'check' })
                    setEditing(null)
                    detail.run()
                  } catch (err) {
                    toast.show({ message: err.code === 'deck_limit' ? t('decks.detail.cardLimit') : err.message, tone: 'danger' })
                  }
                } else saveCard()
              }}
            >
              {t('decks.detail.save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <>
            {!editing.isNew ? (
              <div className={styles.sheetDestructive}>
                <Button variant="text" size="small" icon="trash" onClick={() => deleteCard(editing)}>
                  {t('decks.detail.deleteCard')}
                </Button>
              </div>
            ) : null}
            <Textarea label={t('decks.detail.front')} value={editing.front} onChange={(e) => setEditing({ ...editing, front: e.target.value })} rows={3} />
            <Textarea label={t('decks.detail.back')} value={editing.back} onChange={(e) => setEditing({ ...editing, back: e.target.value })} rows={4} />
            <p className={styles.meta}>
              {editing.isNew
                ? t('decks.detail.mediaLimits')
                : editing.origin?.model
                  ? t('decks.detail.cardOrigin', { document: editing.origin.document, page: editing.origin.page ? t('decks.detail.cardOriginPage', { page: editing.origin.page }) : '', model: editing.origin.model, version: editing.origin.promptVersion })
                  : editing.origin?.document || t('decks.detail.cardOriginManual')}
            </p>
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        title={t('decks.publish.appealTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAppealOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button disabled={!appealText.trim()} onClick={sendAppeal}>
              {t('decks.publish.appealAction')}
            </Button>
          </>
        }
      >
        <p className={styles.meta}>{t('decks.publish.appealText')}</p>
        <Textarea label={t('decks.publish.appealField')} value={appealText} onChange={(e) => setAppealText(e.target.value)} rows={4} autoFocus />
      </Sheet>

      <PublishSheet
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        deck={deck}
        cardsCount={data.cards.length}
        plan={session.plan}
        onPublished={() => {
          detail.run()
          library.run()
        }}
      />
    </div>
  )
}
