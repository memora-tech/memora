import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './study.module.css'
import { Badge, Banner, Button, ConfirmDialog, ProgressBar, Sheet, Segmented, useToast } from '../../design-system/index.js'
import { useT, SUPPORTED_LOCALES } from '../../i18n/index.js'
import { useStudy } from '../../state/StudyContext.jsx'
import { useProto } from '../../state/ProtoContext.jsx'
import { useSwipe } from '../../hooks/useSwipe.js'
import { useLongPress } from '../../hooks/useLongPress.js'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { FlashCard } from './FlashCard.jsx'
import { NoaExplanation } from './NoaCard.jsx'

function HoldOverlay({ hoverSide, onPick }) {
  const t = useT()
  return (
    <div className={styles.hold} role="group" aria-label={t('study.session.holdTitle')}>
      <span className={styles.holdTitle}>{t('study.session.holdTitle')}</span>
      <button type="button" className={styles.holdOption} data-hover={hoverSide === 'hard' ? 'true' : 'false'} onClick={() => onPick('hard')}>
        {t('study.session.hard')}
      </button>
      <button type="button" className={styles.holdOption} data-hover={hoverSide === 'easy' ? 'true' : 'false'} onClick={() => onPick('easy')}>
        {t('study.session.easy')}
      </button>
    </div>
  )
}

function NoaSessionCard({ card, onAccept, onDismiss, onWhy }) {
  const t = useT()
  const swipe = useSwipe({ onSwipeRight: onAccept, onSwipeLeft: onDismiss, onLongPress: onWhy })
  const style = swipe.offset ? { transform: `translateX(${swipe.offset}px) rotate(${swipe.offset / 20}deg)` } : undefined
  return (
    <div className={styles.cardWrap}>
      <div className={styles.noaSessionCard} style={style} {...swipe.handlers} role="group" aria-label={t('study.session.noaLabel')} aria-describedby="noa-hint">
        <div className={styles.noaHead}>
          <Badge tone="noa">{t('study.session.noaLabel')}</Badge>
          <Button variant="text" size="small" icon="help" label={t('study.session.noaWhy')} onClick={onWhy} onPointerDown={(e) => e.stopPropagation()} />
        </div>
        <h2 className={styles.noaTitle}>{card.suggestion.title}</h2>
        <p className={styles.noaBody}>{card.suggestion.body}</p>
        <p id="noa-hint" className={styles.noaHint}>
          {t('study.session.noaSwipeShort')}
        </p>
        <div className={styles.noaActions} onPointerDown={(e) => e.stopPropagation()}>
          <Button onClick={onAccept}>{t('study.session.noaAccept')}</Button>
          <Button variant="ghost" onClick={onDismiss}>
            {t('study.session.noaDismiss')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function StudySession() {
  const t = useT()
  const study = useStudy()
  const proto = useProto()
  const toast = useToast()
  const navigate = useNavigate()
  const a = study.active
  const finishing = useRef(false)
  const [holding, setHolding] = useState(false)
  const [hoverSide, setHoverSide] = useState(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const cardRef = useRef(null)
  const lastFatigue = useRef(proto.fatigueTrigger)
  useDocumentTitle(a?.deckName || t('study.home.todayTitle'))

  useEffect(() => {
    if (!a && !finishing.current) navigate('/app', { replace: true })
  }, [a, navigate])

  useEffect(() => {
    if (proto.fatigueTrigger !== lastFatigue.current) {
      lastFatigue.current = proto.fatigueTrigger
      study.forceFatigue()
    }
  }, [proto.fatigueTrigger, study])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    await study.complete()
    navigate('/app/concluido', { replace: true })
  }, [study, navigate])

  useEffect(() => {
    if (a && a.index >= a.queue.length) finish()
  }, [a, finish])

  useEffect(() => {
    const handler = () => setExitOpen(true)
    window.addEventListener('memora:exit-session', handler)
    return () => window.removeEventListener('memora:exit-session', handler)
  }, [])

  const card = a ? a.queue[a.index] : null
  const flipped = Boolean(a?.flipped)
  const isNoa = card?.type === 'noa'

  const rate = useCallback(
    (rating) => {
      if (!card || isNoa) return
      if (!flipped) study.flip()
      study.rate(rating)
    },
    [card, isNoa, flipped, study]
  )

  const pick = (side) => {
    setHolding(false)
    setHoverSide(null)
    rate(side)
  }

  useEffect(() => {
    if (!holding) return undefined
    const onMove = (e) => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      setHoverSide(e.clientX < rect.left + rect.width / 2 ? 'hard' : 'easy')
    }
    const onUp = (e) => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (rect && e.clientY >= rect.top && e.clientY <= rect.bottom && e.clientX >= rect.left && e.clientX <= rect.right) {
        pick(e.clientX < rect.left + rect.width / 2 ? 'hard' : 'easy')
      } else {
        setHolding(false)
        setHoverSide(null)
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp, { once: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [holding])

  const swipe = useSwipe({
    onTap: () => study.flip(),
    onSwipeLeft: () => rate('again'),
    onSwipeRight: () => rate('good'),
    onLongPress: () => {
      if (!flipped) study.flip()
      setHolding(true)
    }
  })

  const translateHold = useLongPress({
    onLongPress: () => setLangOpen(true),
    onTap: () => study.setTranslation({ on: !a?.translation?.on })
  })

  const shortcuts = useMemo(
    () => ({
      Space: () => (isNoa ? null : study.flip()),
      Enter: () => (isNoa ? null : study.flip()),
      ArrowLeft: () => (isNoa ? respondNoa(false) : rate('again')),
      ArrowRight: () => (isNoa ? respondNoa(true) : rate('good')),
      1: () => rate('hard'),
      2: () => rate('easy'),
      Escape: () => setExitOpen(true)
    }),
    [isNoa, rate, study]
  )
  useKeyboardShortcuts(shortcuts, { enabled: Boolean(a) && !exitOpen && !explainOpen && !langOpen })

  async function respondNoa(accepted) {
    const result = await study.respondNoa(accepted)
    if (accepted && result?.effect?.type === 'deck_marked_difficult') {
      toast.show({
        message: t('study.session.noaDeckMarked', { deck: result.effect.deckName }),
        icon: 'check',
        action: { label: t('study.session.undo'), onClick: () => studentApi.patch(`/decks/${result.effect.deckId}`, { difficult: false }).catch(() => {}) },
        duration: 5000
      })
    } else if (!accepted) {
      toast.show({ message: t('study.session.noaDismissed') })
    }
  }

  if (!a || !card) return null

  const realIndex = a.queue.slice(0, a.index).filter((c) => c.type !== 'noa').length + (isNoa ? 0 : 1)
  const action = study.catalog?.actions?.find((x) => x.key === card.suggestion?.actionKey)
  const fatigueText = a.fatigueSignals
    ? Object.entries(a.fatigueSignals)
        .filter(([k, v]) => v && k !== 'simulated')
        .map(([k]) => t(`study.session.fatigueSignals.${k}`))
        .join(t('common.and'))
    : ''

  return (
    <section className={styles.session} aria-label={a.deckName || t('study.home.todayTitle')}>
      <div className={styles.sessionProgress}>
        <ProgressBar value={realIndex - (isNoa ? 0 : 1)} max={a.total} thin label={t('study.session.progress', { index: realIndex, total: a.total })} />
      </div>
      <div className={styles.sessionHeader}>
        <span className={styles.sessionDeck}>{a.deckName || t('study.home.todayTitle')}</span>
        <span className={styles.sessionCount} aria-live="polite">
          {t('study.session.progress', { index: Math.min(realIndex, a.total), total: a.total })}
        </span>
        <Button variant="text" icon="x" label={t('study.session.exit')} onClick={() => setExitOpen(true)} />
      </div>

      {a.reduced ? (
        <div className={styles.fatigue}>
          <Banner tone="warning" icon="clock" action={<Button size="small" variant="soft" onClick={() => { study.keepLoad(); toast.show({ message: t('study.session.fatigueKept') }) }}>{t('study.session.fatigueKeep')}</Button>}>
            {t('study.session.fatigueShort', { removed: a.removed ?? 0 })}
          </Banner>
        </div>
      ) : null}

      <div className={styles.sessionBody}>
        {isNoa ? (
          <NoaSessionCard card={card} onAccept={() => respondNoa(true)} onDismiss={() => respondNoa(false)} onWhy={() => setExplainOpen(true)} />
        ) : (
          <FlashCard
            card={card}
            flipped={flipped}
            translation={a.translation}
            dragOffset={swipe.offset}
            dragging={swipe.dragging}
            cardRef={cardRef}
            holdOverlay={holding ? <HoldOverlay hoverSide={hoverSide} onPick={pick} /> : null}
            {...swipe.handlers}
            onClick={(e) => {
              if (e.detail === 0) study.flip()
            }}
          />
        )}
      </div>

      {!isNoa ? (
        <>
          {a.translation?.available ? (
            <div className={styles.toolBar}>
              <Button variant={a.translation.on ? 'soft' : 'ghost'} size="small" icon="translate" iconRight="chevronDown" {...translateHold} aria-pressed={a.translation.on ? 'true' : 'false'} aria-describedby="translate-hint">
                {a.translation.on ? t('study.session.translateOff') : t('study.session.translate')}
              </Button>
              <span id="translate-hint" className="sr-only">
                {t('study.session.translateHold')}
              </span>
              {a.translation.on ? <p className={styles.translateNotice}>{card.translation?.[a.translation.lang] ? t('study.session.translated', { from: a.translation.from?.toUpperCase() }) : t('study.session.translateUnavailable')}</p> : null}
            </div>
          ) : null}
          {flipped ? (
            <div className={styles.rating} role="group" aria-label={t('study.session.back')}>
              <button type="button" className={[styles.ratingBtn, styles.ratingAgain].join(' ')} onClick={() => rate('again')}>
                {t('study.session.again')}
                <span className={styles.ratingKey}>←</span>
              </button>
              <button type="button" className={[styles.ratingBtn, styles.ratingHard].join(' ')} onClick={() => rate('hard')}>
                {t('study.session.hard')}
                <span className={styles.ratingKey}>1</span>
              </button>
              <button type="button" className={[styles.ratingBtn, styles.ratingGood].join(' ')} onClick={() => rate('good')}>
                {t('study.session.good')}
                <span className={styles.ratingKey}>→</span>
              </button>
              <button type="button" className={[styles.ratingBtn, styles.ratingEasy].join(' ')} onClick={() => rate('easy')}>
                {t('study.session.easy')}
                <span className={styles.ratingKey}>2</span>
              </button>
            </div>
          ) : (
            <div className={styles.flipBar}>
              <Button variant="ghost" block onClick={() => study.flip()}>
                {t('study.session.flipHint')}
              </Button>
              <p className={styles.keyboardHint}>{t('study.session.keyboard')}</p>
            </div>
          )}
        </>
      ) : null}

      <ConfirmDialog open={exitOpen} onClose={() => setExitOpen(false)} title={t('study.session.exitConfirmTitle')} confirmLabel={t('study.session.exitConfirm')} onConfirm={() => { finishing.current = true; study.exit(); navigate('/app', { replace: true }) }}>
        <p>{t('study.session.exitConfirmText')}</p>
      </ConfirmDialog>

      <NoaExplanation open={explainOpen} onClose={() => setExplainOpen(false)} action={action} budget={study.today?.noaBudget} catalogVersion={study.catalog?.version} signals={a.reduced ? fatigueText : null} />

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('study.session.translateLangTitle')}>
        <Segmented
          label={t('study.session.translateLangTitle')}
          value={a.translation?.lang}
          onChange={(lang) => {
            study.setTranslation({ lang, on: true })
            setLangOpen(false)
          }}
          options={SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: l.label, disabled: !l.available }))}
        />
      </Sheet>
    </section>
  )
}
