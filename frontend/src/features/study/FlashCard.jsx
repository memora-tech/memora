import { useEffect, useRef, useState } from 'react'
import styles from './study.module.css'
import { Button, Icon, ProgressBar } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

export function AudioPlayer({ media, showTranscript }) {
  const t = useT()
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timer = useRef(null)
  const duration = media?.durationSec || 3

  useEffect(() => () => clearInterval(timer.current), [])

  const play = () => {
    clearInterval(timer.current)
    setElapsed(0)
    setPlaying(true)
    const startedAt = Date.now()
    timer.current = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000
      if (secs >= duration) {
        clearInterval(timer.current)
        setElapsed(duration)
        setPlaying(false)
      } else {
        setElapsed(secs)
      }
    }, 100)
  }

  return (
    <div className={styles.audio} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className={styles.audioRow}>
        <Button variant="soft" icon={playing ? 'volume' : 'play'} label={playing ? t('study.session.audioPlaying') : elapsed ? t('study.session.audioReplay') : t('study.session.audioPlay', { seconds: duration })} onClick={play} aria-pressed={playing ? 'true' : 'false'} />
        <div className={styles.audioTrack}>
          <ProgressBar value={elapsed} max={duration} thin label={t('study.session.audioPlay', { seconds: duration })} />
        </div>
        <span className={styles.audioTime}>
          {Math.floor(elapsed)}s / {duration}s
        </span>
      </div>
      {showTranscript && media?.transcript ? (
        <p className={styles.planMeta}>
          {t('study.session.audioTranscript')}: {media.transcript}
        </p>
      ) : null}
    </div>
  )
}

export function FlashCard({ card, flipped, translation, dragOffset, dragging, holdOverlay, cardRef, ...rest }) {
  const t = useT()
  const translated = translation?.on && card.translation?.[translation.lang]
  const front = translated ? card.translation[translation.lang].front : card.front
  const back = translated ? card.translation[translation.lang].back : card.back
  const rotation = dragOffset ? dragOffset / 18 : 0
  const style = dragOffset ? { transform: `translateX(${dragOffset}px) rotate(${rotation}deg)` } : undefined
  const leftOpacity = dragOffset < -30 ? Math.min(1, (-dragOffset - 30) / 60) : 0
  const rightOpacity = dragOffset > 30 ? Math.min(1, (dragOffset - 30) / 60) : 0

  return (
    <div className={styles.cardWrap}>
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={flipped ? `${t('study.session.back')}: ${back}` : `${t('study.session.front')}: ${front}. ${t('study.session.flipHint')}`}
        aria-pressed={flipped ? 'true' : 'false'}
        className={[styles.card, dragging && styles.cardDragging, card.relearn && styles.cardRelearn].filter(Boolean).join(' ')}
        style={style}
        {...rest}
      >
        <span className={[styles.swipeHint, styles.swipeHintLeft].join(' ')} style={{ opacity: leftOpacity }} aria-hidden="true">
          {t('study.session.swipeLeft')}
        </span>
        <span className={[styles.swipeHint, styles.swipeHintRight].join(' ')} style={{ opacity: rightOpacity }} aria-hidden="true">
          {t('study.session.swipeRight')}
        </span>
        <div className={styles.cardFace}>
          <span className={styles.cardSide}>{flipped ? t('study.session.back') : t('study.session.front')}</span>
          {card.type === 'image' && card.media?.src ? (
            <div className={styles.cardImage}>
              <img src={card.media.src} alt={card.media.alt || t('study.session.imageFallback')} />
            </div>
          ) : null}
          <p className={styles.cardText}>{front}</p>
          {card.type === 'audio' ? <AudioPlayer media={card.media} showTranscript={flipped} /> : null}
          {flipped ? <p className={styles.cardAnswer}>{back}</p> : null}
        </div>
        <div className={styles.cardFooter}>
          <span className={styles.cardOrigin}>
            {card.relearn ? (
              <>
                <Icon name="refresh" size={14} /> {t('study.session.relearn')}
              </>
            ) : card.deckName ? (
              card.deckName
            ) : null}
          </span>
          {translated ? (
            <span className={styles.cardOrigin}>
              <Icon name="translate" size={14} /> {translation.from?.toUpperCase()}
            </span>
          ) : null}
        </div>
        {holdOverlay}
      </div>
    </div>
  )
}
