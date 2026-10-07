import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Badge, Banner, Button, Chip, ConfirmDialog, Icon, OverflowMenu, QACard, ScreenHeader, Segmented, Sheet, Skeleton, Surface, Textarea, useToast } from '../../design-system/index.js'
import { useT, SUPPORTED_LOCALES } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useLongPress } from '../../hooks/useLongPress.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber } from '../../lib/format.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useSession } from '../../state/SessionContext.jsx'
import { CommentsSheet } from './CommentsSheet.jsx'

export function CommunityDeck() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const study = useStudy()
  const session = useSession()
  const { deckId } = useParams()
  const detail = useAsync(() => studentApi.get(`/community/decks/${deckId}`), [deckId])
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [reportDetail, setReportDetail] = useState('')
  const [translation, setTranslation] = useState({ on: false, lang: session.user?.locale || 'pt-BR', cards: null })
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const data = detail.data
  const deck = data?.deck
  useDocumentTitle(deck?.name)

  const refresh = () => detail.run()

  const guardianToast = (err, fallback) => {
    if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
    else if (err.code === 'verification_required') toast.show({ message: t('common.verification.required', { action: t('common.verification.actions.comment') }), tone: 'danger' })
    else toast.show({ message: fallback || err.message, tone: 'danger' })
  }

  const favorite = async () => {
    try {
      const res = await studentApi.post(`/community/decks/${deckId}/favorite`)
      toast.show({
        message: res.favorited ? t('community.deck.favoriteToast') : t('community.deck.unfavoriteToast'),
        icon: 'heart',
        action: { label: t('common.actions.undo'), onClick: () => studentApi.post(`/community/decks/${deckId}/favorite`).then(refresh) },
        duration: 3000
      })
      refresh()
    } catch (err) {
      guardianToast(err)
    }
  }

  const clone = async () => {
    setBusy(true)
    try {
      const res = await studentApi.post(`/community/decks/${deckId}/clone`)
      setCloneOpen(false)
      toast.show({ message: t('community.deck.cloneDone'), icon: 'copy', action: { label: t('community.deck.openClone'), onClick: () => navigate(`/app/decks/${res.deckId}`) }, duration: 5000 })
      refresh()
    } catch (err) {
      guardianToast(err)
    } finally {
      setBusy(false)
    }
  }

  const vote = async () => {
    try {
      await studentApi.post(`/community/decks/${deckId}/vote`)
      refresh()
    } catch (err) {
      if (err.code === 'vote_not_allowed') toast.show({ message: t('community.deck.voteLocked', { pct: 30, min: 20, answered: err.body.answered, total: err.body.total }) })
      else guardianToast(err)
    }
  }

  const react = async (emoji) => {
    try {
      await studentApi.post(`/community/decks/${deckId}/react`, { emoji })
      refresh()
    } catch (err) {
      guardianToast(err)
    }
  }

  const share = async (channel) => {
    try {
      const res = await studentApi.post(`/community/decks/${deckId}/share`, { channel })
      const url = `${window.location.origin}${res.url}`
      if (channel === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(`${deck.name} · ${url}`)}`, '_blank', 'noopener')
      else if (channel === 'copy' || channel === 'instagram') {
        try {
          await navigator.clipboard.writeText(url)
          toast.show({ message: t('community.deck.shareCopied'), icon: 'copy' })
        } catch {
          toast.show({ message: url })
        }
      }
      setShareOpen(false)
    } catch (err) {
      setShareOpen(false)
      if (err.code === 'guardian_required') toast.show({ message: t('community.deck.shareMinor'), icon: 'shield', duration: 6000 })
      else guardianToast(err)
    }
  }

  const report = async (reason) => {
    try {
      await studentApi.post(`/community/decks/${deckId}/report`, { reason, detail: reportDetail })
      setReportOpen(false)
      setReportDetail('')
      toast.show({ message: t('community.deck.reportSent'), icon: 'flag', duration: 6000 })
    } catch (err) {
      guardianToast(err)
    }
  }

  const translateAll = async (lang = translation.lang, on = true) => {
    if (!on) {
      setTranslation((s) => ({ ...s, on: false }))
      return
    }
    try {
      const res = await studentApi.post(`/community/decks/${deckId}/translate`, { lang })
      setTranslation({ on: true, lang, cards: Object.fromEntries(res.cards.map((c) => [c.id, c.translated])) })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const translateHold = useLongPress({ onLongPress: () => setLangOpen(true), onTap: () => translateAll(translation.lang, !translation.on) })

  const startStudy = async () => {
    try {
      const res = await studentApi.post(`/community/decks/${deckId}/study-start`)
      const cards = res.cards.map((c) => ({ ...c, deckName: deck.name }))
      if (study.start({ mode: 'community', deckId, deckName: deck.name, cards, translationAvailable: data.translation.available, lang: session.user?.locale || 'pt-BR' })) navigate('/app/estudar')
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (detail.loading && !data) return <Skeleton height={140} count={3} />
  if (detail.error && !data) {
    return (
      <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={refresh}>{t('common.actions.retry')}</Button>}>
        {detail.error.status === 404 ? t('community.deck.notFound') : t('common.state.error')}
      </Banner>
    )
  }
  if (!deck) return null

  const v = deck.viewer
  const cards = showAll ? data.cards : data.cards.slice(0, 3)
  const canTranslate = data.translation.available

  return (
    <div className={styles.page}>
      <ScreenHeader
        crumbs={[{ label: t('community.title'), to: '/app/comunidade' }, { label: deck.name }]}
        eyebrow={t('community.kinds.flashcards')}
        title={deck.name}
        lead={deck.description || null}
        actions={
          <OverflowMenu
            label={t('common.actions.more')}
            items={[
              canTranslate ? { key: 'translate', icon: 'translate', label: t('community.deck.translateAll'), onSelect: () => translateAll(translation.lang, true) } : null,
              { key: 'report', icon: 'flag', label: t('community.deck.report'), danger: true, onSelect: () => setReportOpen(true) }
            ]}
          />
        }
      />

      <div className={styles.deckMeta}>
        <Chip tone="brand">{deck.categoryName}</Chip>
        <Chip tone="neutral">{t(`common.difficulty.${deck.difficulty}`)}</Chip>
        <Chip tone="neutral">{t('community.cards', { count: deck.cardCount })}</Chip>
        {deck.lang !== 'pt-BR' ? <Chip tone="brand" icon="globe">{t('community.lang', { lang: t(`community.langNames.${deck.lang}`) })}</Chip> : null}
      </div>

      <div className={styles.primaryRow}>
        <Button size="large" icon="play" onClick={startStudy}>
          {t('community.deck.studyNow')}
        </Button>
        <div className={styles.secondary} role="group" aria-label={t('common.actions.more')}>
          <button type="button" className={styles.secondaryBtn} aria-pressed={v.favorited ? 'true' : 'false'} onClick={favorite}>
            <Icon name="heart" size={20} />
            <span className={styles.secondaryLabel}>{v.favorited ? t('community.deck.favorited') : t('community.deck.favorite')}</span>
          </button>
          <button type="button" className={styles.secondaryBtn} aria-pressed={v.cloned ? 'true' : 'false'} onClick={() => setCloneOpen(true)}>
            <Icon name="copy" size={20} />
            <span className={styles.secondaryLabel}>{v.cloned ? t('community.deck.cloned') : t('community.deck.clone')}</span>
          </button>
          <button type="button" className={styles.secondaryBtn} aria-pressed={v.voted ? 'true' : 'false'} disabled={!v.canVote} onClick={vote} aria-describedby="vote-hint">
            <Icon name="star" size={20} />
            <span className={styles.secondaryLabel}>{v.voted ? t('community.deck.voted') : t('community.deck.vote')}</span>
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => setShareOpen(true)}>
            <Icon name="share" size={20} />
            <span className={styles.secondaryLabel}>{t('community.deck.share')}</span>
          </button>
        </div>
      </div>
      <p id="vote-hint" className={styles.meta}>
        {v.canVote ? t('community.deck.voteUnlocked') : t('community.deck.voteLocked', { pct: v.voteRule.minPct, min: v.voteRule.minCards, answered: v.answered, total: v.total })}
      </p>

      {data.newVersionNotice ? (
        <Banner tone="brand" icon="info">
          {t('community.deck.newVersionShort', { current: data.newVersionNotice.current, studied: data.newVersionNotice.studiedVersion })}
        </Banner>
      ) : null}

      <Surface className={styles.authorRow}>
        <Link to={`/app/comunidade/autor/${deck.author.id}`} className={styles.authorLink}>
          <Avatar name={deck.author.name} />
          <span className={styles.authorBody}>
            <span className={styles.authorName}>{deck.author.name}</span>
            <span className={styles.authorMeta}>{t('community.author.level', { level: deck.author.level, topic: deck.author.topic })}</span>
          </span>
        </Link>
        <Button
          size="small"
          variant={deck.author.following ? 'soft' : 'ghost'}
          icon={deck.author.following ? 'check' : 'plus'}
          aria-pressed={deck.author.following ? 'true' : 'false'}
          onClick={async () => {
            try {
              await studentApi.post(`/community/authors/${deck.author.id}/follow`)
              refresh()
            } catch (err) {
              guardianToast(err)
            }
          }}
        >
          {deck.author.following ? t('community.deck.followingAuthor') : t('community.deck.follow')}
        </Button>
      </Surface>

      <Surface>
        <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>
          <span>{t('community.deck.reactions')}</span>
          <Button size="small" variant="text" icon="message" onClick={() => setCommentsOpen(true)}>
            {t('community.deck.comments', { count: deck.commentCount })}
          </Button>
        </div>
        <div className={styles.reactions} role="group" aria-label={t('community.deck.reactions')}>
          {data.reactionsList.map((emoji) => {
            const count = deck.reactions[emoji] || 0
            const mine = v.myReactions.includes(emoji)
            return (
              <button key={emoji} type="button" className={styles.reaction} aria-pressed={mine ? 'true' : 'false'} aria-label={t(mine ? 'community.deck.reactRemove' : 'community.deck.react', { emoji, count })} onClick={() => react(emoji)}>
                <span aria-hidden="true">{emoji}</span>
                <span className="tabnum">{fmtNumber(count)}</span>
              </button>
            )
          })}
        </div>
      </Surface>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2 style={{ fontSize: 'var(--size-heading)' }}>{t('community.deck.cardsTitle')}</h2>
          {canTranslate ? (
            <Button size="small" variant={translation.on ? 'soft' : 'ghost'} icon="translate" aria-pressed={translation.on ? 'true' : 'false'} {...translateHold} aria-describedby="translate-hint">
              {translation.on ? t('community.deck.translateOff') : t('community.deck.translate')}
            </Button>
          ) : null}
        </div>
        {canTranslate ? (
          <p id="translate-hint" className={styles.meta}>
            {translation.on ? t('community.deck.translated', { from: t(`community.langNames.${deck.lang}`) }) : t('community.deck.translateHold')}
          </p>
        ) : null}
        <div className={styles.cardList}>
          {cards.map((c) => {
            const tr = translation.on ? translation.cards?.[c.id] : null
            return <QACard key={c.id} index={data.cards.indexOf(c) + 1} question={tr?.front || c.front} answer={tr?.back || c.back} />
          })}
        </div>
        {data.cards.length > 3 ? (
          <div className={styles.sectionFooter}>
            <Button variant="ghost" size="small" iconRight={showAll ? 'chevronUp' : 'chevronDown'} onClick={() => setShowAll((s) => !s)}>
              {showAll ? t('community.deck.showLess') : t('community.deck.showAll')}
            </Button>
          </div>
        ) : null}
      </div>

      <CommentsSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} deckId={deckId} onChanged={refresh} />

      <ConfirmDialog open={cloneOpen} onClose={() => setCloneOpen(false)} onConfirm={clone} title={t('community.deck.cloneTitle')} confirmLabel={t('community.deck.clone')} loading={busy}>
        <p>{t('community.deck.cloneText', { author: deck.author.name })}</p>
      </ConfirmDialog>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title={t('community.deck.shareTitle')}>
        <p className={styles.meta}>{t('community.deck.shareText')}</p>
        <Button variant="soft" icon="message" block onClick={() => share('whatsapp')}>
          {t('community.deck.shareWhatsapp')}
        </Button>
        <Button variant="soft" icon="image" block onClick={() => share('instagram')}>
          {t('community.deck.shareInstagram')}
        </Button>
        <Button variant="ghost" icon="copy" block onClick={() => share('copy')}>
          {t('community.deck.shareCopy')}
        </Button>
      </Sheet>

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title={t('community.deck.reportTitle')}>
        <p className={styles.meta}>{t('community.deck.reportHint')}</p>
        <Textarea label={t('community.deck.reportDetail')} optional value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} rows={2} />
        <div className={styles.cardList} role="group" aria-label={t('community.deck.reportReason')}>
          {(Array.isArray(t('community.deck.reasons')) ? t('community.deck.reasons') : []).map((r) => (
            <Button key={r} variant="ghost" block icon="flag" onClick={() => report(r)}>
              {r}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('community.deck.translateLang')}>
        <Segmented
          label={t('community.deck.translateLang')}
          value={translation.lang}
          onChange={(lang) => {
            setLangOpen(false)
            translateAll(lang, true)
          }}
          options={SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: l.label, disabled: !l.available }))}
        />
      </Sheet>
    </div>
  )
}
