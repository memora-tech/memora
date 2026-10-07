import styles from './community.module.css'
import { Avatar, Badge, Chip, Icon, Surface } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber } from '../../lib/format.js'
import { KindTag } from './kinds.jsx'

export function CommunityDeckCard({ deck, because }) {
  const t = useT()
  return (
    <Surface interactive to={`/app/comunidade/deck/${deck.id}`} className={styles.contentCard} data-kind="flashcards">
      <span className={styles.cardHead}>
        <KindTag kind="flashcards" small />
        <span className={styles.cardLength}>{t('community.cards', { count: deck.cardCount })}</span>
      </span>
      <span className={styles.deckTop}>
        <span className={styles.deckName}>{deck.name}</span>
        {deck.lang && deck.lang !== 'pt-BR' ? <Badge tone="brand" icon="globe">{t('community.lang', { lang: t(`community.langNames.${deck.lang}`) })}</Badge> : null}
      </span>
      {deck.description ? <span className={styles.excerpt}>{deck.description}</span> : null}
      <span className={styles.cardFoot}>
        <span className={styles.cardAuthor}>
          <Avatar name={deck.author?.name} />
          <span className={styles.cardAuthorText}>
            <span className={styles.cardAuthorName}>{deck.author?.name}</span>
            <span className={styles.cardAuthorMeta}>
              {deck.categoryName} · {t(`common.difficulty.${deck.difficulty}`)}
            </span>
          </span>
        </span>
        <span className={styles.deckStats}>
          <span className={styles.stat}>
            <Icon name="book" size={14} />
            {fmtNumber(deck.stats.studiedWeek)} <span className="sr-only">{t('community.studiedLabel')}</span>
          </span>
          <span className={styles.stat}>
            <Icon name="star" size={14} />
            {fmtNumber(deck.stats.votes)} <span className="sr-only">{t('community.votesLabel')}</span>
          </span>
          {deck.viewer?.favorited ? <Chip tone="reward" icon="heart">{t('community.deck.favorited')}</Chip> : null}
        </span>
      </span>
      {because ? <span className={styles.deckBecause}>{because}</span> : null}
    </Surface>
  )
}
