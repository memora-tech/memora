import styles from './community.module.css'
import { Badge, Chip, Icon, Surface } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber } from '../../lib/format.js'

export function CommunityDeckCard({ deck, because }) {
  const t = useT()
  return (
    <Surface interactive to={`/app/comunidade/deck/${deck.id}`} className={styles.deckCard} aria-label={`${deck.name}, ${t('community.deck.byAuthor')} ${deck.author?.name || ''}`}>
      <div className={styles.deckTop}>
        <span className={styles.deckName}>{deck.name}</span>
        {deck.lang && deck.lang !== 'pt-BR' ? <Badge tone="brand" icon="globe">{t('community.lang', { lang: t(`community.langNames.${deck.lang}`) })}</Badge> : null}
      </div>
      <div className={styles.deckMeta}>
        <span>{deck.author?.name}</span>
        <span aria-hidden="true">·</span>
        <span>{deck.categoryName}</span>
        <span aria-hidden="true">·</span>
        <span>{t('community.cards', { count: deck.cardCount })}</span>
      </div>
      <div className={styles.deckStats}>
        <span className={styles.stat}>
          <Icon name="book" size={14} /> {fmtNumber(deck.stats.studiedWeek)}
        </span>
        <span className={styles.stat}>
          <Icon name="star" size={14} /> {fmtNumber(deck.stats.votes)}
        </span>
        <span className={styles.stat}>
          <Icon name="heart" size={14} /> {fmtNumber(deck.stats.favorites)}
        </span>
        {deck.viewer?.favorited ? <Chip tone="reward" icon="heart">{t('community.deck.favorited')}</Chip> : null}
      </div>
      {because ? <span className={styles.deckBecause}>{because}</span> : null}
    </Surface>
  )
}
