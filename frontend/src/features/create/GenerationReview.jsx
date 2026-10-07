import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './create.module.css'
import { Badge, Banner, Button, Chip, Input, PageHeader, Segmented, Select, Sheet, Skeleton, Surface, Textarea, Toggle, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useSwipe } from '../../hooks/useSwipe.js'
import { studentApi } from '../../lib/api.js'
import { storage } from '../../lib/storage.js'
import { ACTIVE_JOB_KEY } from '../../areas/student/LayoutBanners.jsx'

function CardRow({ card, onEdit, onDelete }) {
  const t = useT()
  const swipe = useSwipe({ onSwipeLeft: onDelete, onTap: onEdit, threshold: 110 })
  const style = swipe.offset < 0 ? { transform: `translateX(${Math.max(swipe.offset, -160)}px)` } : undefined
  return (
    <div className={styles.cardRow}>
      <div className={styles.cardRowDelete} aria-hidden="true">
        {t('create.review.deleteCard')}
      </div>
      <Surface
        as="div"
        role="button"
        tabIndex={0}
        className={[styles.cardItem, swipe.dragging && styles.cardItemDragging].filter(Boolean).join(' ')}
        style={style}
        aria-label={`${card.front}. ${t('create.review.tapToEdit')}. ${t('create.review.swipeDelete')}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEdit()
          }
          if (e.key === 'Delete') onDelete()
        }}
        {...swipe.handlers}
      >
        <span className={styles.cardFront}>{card.front}</span>
        <span className={styles.cardBack}>{card.back}</span>
        <span className={styles.cardMeta}>
          {card.uncertain ? <Badge tone="warning" icon="alert">{t('create.review.uncertain')}</Badge> : null}
          {card.edited ? <Badge tone="brand">{t('common.actions.edit')}</Badge> : null}
          <span>
            {t('create.review.origin', { document: card.origin?.document || '' })}
            {card.origin?.page ? `, ${t('create.review.originPage', { page: card.origin.page })}` : ''}
          </span>
        </span>
      </Surface>
    </div>
  )
}

export function GenerationReview() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [cards, setCards] = useState([])
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [keepOriginal, setKeepOriginal] = useState(false)
  useDocumentTitle(t('create.review.title'))

  useEffect(() => {
    Promise.all([studentApi.get(`/generation/jobs/${jobId}`), studentApi.get('/decks')])
      .then(([j, d]) => {
        setJob(j.job)
        setCategories(d.categories || [])
        if (j.job.result) {
          setMeta({ ...j.job.result.suggested, tagsText: (j.job.result.suggested.tags || []).join(', ') })
          setCards(j.job.result.cards.map((c) => ({ ...c })))
        }
      })
      .catch((err) => toast.show({ message: err.message, tone: 'danger' }))
  }, [jobId, toast])

  const uncertainCount = useMemo(() => cards.filter((c) => c.uncertain).length, [cards])

  const removeCard = (tempId) => {
    const removed = cards.find((c) => c.tempId === tempId)
    const index = cards.findIndex((c) => c.tempId === tempId)
    setCards((list) => list.filter((c) => c.tempId !== tempId))
    toast.show({
      message: t('create.review.deleted'),
      icon: 'trash',
      action: { label: t('common.actions.undo'), onClick: () => setCards((list) => [...list.slice(0, index), removed, ...list.slice(index)]) },
      duration: 5000
    })
  }

  const saveEdit = () => {
    setCards((list) => list.map((c) => (c.tempId === editing.tempId ? { ...editing, edited: true, uncertain: false } : c)))
    setEditing(null)
  }

  const addCard = () => {
    const tempId = `${jobId}_new_${Date.now().toString(36)}`
    setEditing({ tempId, type: 'text', front: '', back: '', uncertain: false, origin: { document: t('create.review.manualOrigin'), page: null }, isNew: true })
  }

  const saveNew = () => {
    if (!editing.front.trim() || !editing.back.trim()) return
    setCards((list) => [...list, { ...editing, isNew: false, edited: true }])
    setEditing(null)
  }

  const approve = async () => {
    setBusy(true)
    try {
      const data = await studentApi.post(`/generation/jobs/${jobId}/approve`, {
        name: meta.name,
        categoryId: meta.categoryId,
        tags: meta.tagsText.split(',').map((x) => x.trim()).filter(Boolean),
        difficulty: meta.difficulty,
        keepOriginal,
        cards: cards.map(({ tempId: _t, isNew: _n, ...c }) => c)
      })
      storage.remove(ACTIVE_JOB_KEY)
      toast.show({ message: t('create.review.created', { count: data.cards }), tone: 'reward', icon: 'check' })
      navigate(`/app/decks/${data.deckId}`, { replace: true })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  if (!job || !meta) {
    return (
      <Surface>
        <Skeleton height={24} width="50%" />
        <div style={{ height: 12 }} />
        <Skeleton height={80} count={3} />
      </Surface>
    )
  }

  const categoryName = categories.find((c) => c.id === meta.categoryId)?.name || meta.categoryId

  return (
    <div className={styles.page}>
      <PageHeader title={t('create.review.title')} backTo="/app/criar" backLabel={t('create.title')} />

      <Surface tone="noa">
        <div className={styles.titleRow}>
          <Badge tone="noa">{t('create.review.suggested')}</Badge>
          {confirmed && !editingMeta ? (
            <Button size="small" variant="text" onClick={() => setEditingMeta(true)}>
              {t('create.review.editSuggestion')}
            </Button>
          ) : null}
        </div>
        {!editingMeta && (confirmed || true) ? (
          <div style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 'var(--size-heading)' }}>{meta.name}</h2>
            <div className={styles.summaryChips} style={{ marginTop: 8 }}>
              <Chip tone="brand">{categoryName}</Chip>
              <Chip tone="neutral">{t(`common.difficulty.${meta.difficulty}`)}</Chip>
              {meta.tagsText.split(',').map((x) => x.trim()).filter(Boolean).map((tag) => (
                <Chip key={tag} tone="neutral" icon="tag">
                  {tag}
                </Chip>
              ))}
            </div>
            {!confirmed ? (
              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <Button size="small" icon="check" onClick={() => setConfirmed(true)}>
                  {t('create.review.confirmSuggestion')}
                </Button>
                <Button size="small" variant="text" onClick={() => setEditingMeta(true)}>
                  {t('create.review.editSuggestion')}
                </Button>
              </div>
            ) : (
              <p className={styles.meta} style={{ marginTop: 12 }}>
                {t('create.review.suggestionConfirmed')}
              </p>
            )}
          </div>
        ) : null}
        {editingMeta ? (
          <div className={styles.suggestionGrid} style={{ marginTop: 12 }}>
            <Input label={t('create.review.name')} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
            <Select label={t('create.review.category')} hint={t('create.review.provisional')} value={meta.categoryId} onChange={(e) => setMeta({ ...meta, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label={t('create.review.tags')} hint={t('create.review.tagsHint')} value={meta.tagsText} onChange={(e) => setMeta({ ...meta, tagsText: e.target.value })} />
            <div>
              <p className={styles.meta} style={{ marginBottom: 8 }}>
                {t('create.review.difficulty')}
              </p>
              <Segmented label={t('create.review.difficulty')} value={meta.difficulty} onChange={(v) => setMeta({ ...meta, difficulty: v })} options={['facil', 'medio', 'dificil'].map((d) => ({ value: d, label: t(`common.difficulty.${d}`) }))} />
            </div>
            <Button
              size="small"
              icon="check"
              onClick={() => {
                setEditingMeta(false)
                setConfirmed(true)
              }}
            >
              {t('create.review.confirmSuggestion')}
            </Button>
          </div>
        ) : null}
      </Surface>

      <div className={styles.titleRow}>
        <h2 style={{ fontSize: 'var(--size-heading)' }}>{job.source === 'anki' ? t('create.review.ankiCards', { count: cards.length }) : t('create.review.cards', { count: cards.length })}</h2>
        <Button size="small" variant="text" icon="plus" onClick={addCard}>
          {t('create.review.addCard')}
        </Button>
      </div>
      {job.source === 'anki' ? <p className={styles.meta}>{t('create.ankiNote')}</p> : null}
      {uncertainCount ? (
        <Banner tone="warning" icon="alert">
          {t('create.review.filters', { count: uncertainCount })}. {t('create.review.uncertainHelp')}
        </Banner>
      ) : null}
      <p className={styles.meta}>{t('create.review.swipeDelete')}</p>

      <div className={styles.cardList}>
        {cards.map((card) => (
          <CardRow key={card.tempId} card={card} onEdit={() => setEditing({ ...card })} onDelete={() => removeCard(card.tempId)} />
        ))}
        {!cards.length ? <p className={styles.meta}>{t('create.review.empty')}</p> : null}
      </div>

      {job.source !== 'anki' && job.source !== 'empty' ? (
        <Surface tone="sunken">
          <Toggle checked={keepOriginal} onChange={setKeepOriginal} label={t('create.keepOriginal')} help={t('create.review.keepOriginalHelp')} />
        </Surface>
      ) : null}

      <div className={styles.approveBar}>
        <Button size="large" block icon="check" loading={busy} disabled={!cards.length} onClick={approve}>
          {cards.length === (job.result?.cards?.length || 0) ? t('create.review.approveAll') : t('create.review.approveCount', { count: cards.length })}
        </Button>
      </div>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? t('create.review.addCard') : t('create.review.editCard')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button icon="check" onClick={editing?.isNew ? saveNew : saveEdit}>
              {t('create.review.save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <>
            {!editing.isNew ? (
              <div className={styles.sheetDestructive}>
                <Button variant="text" size="small" icon="trash" onClick={() => { removeCard(editing.tempId); setEditing(null) }}>
                  {t('create.review.deleteCard')}
                </Button>
              </div>
            ) : null}
            <Textarea label={t('create.review.front')} value={editing.front} onChange={(e) => setEditing({ ...editing, front: e.target.value })} rows={3} />
            <Textarea label={t('create.review.back')} value={editing.back} onChange={(e) => setEditing({ ...editing, back: e.target.value })} rows={4} />
            {editing.uncertain ? (
              <Banner tone="warning" icon="alert">
                {t('create.review.uncertainHelp')}
              </Banner>
            ) : null}
            <p className={styles.meta}>
              {t('create.review.origin', { document: editing.origin?.document || '' })}
              {editing.origin?.page ? `, ${t('create.review.originPage', { page: editing.origin.page })}` : ''}
              {editing.origin?.model ? ` · ${t('create.review.model', { model: editing.origin.model, version: editing.origin.promptVersion })}` : ''}
            </p>
          </>
        ) : null}
      </Sheet>
    </div>
  )
}
