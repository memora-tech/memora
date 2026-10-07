import styles from './community.module.css'
import { Avatar, Chip, Icon, Surface } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtNumber } from '../../lib/format.js'
import { CommunityDeckCard } from './CommunityDeckCard.jsx'
import { KindTag, itemLink } from './kinds.jsx'

function Preview({ item }) {
  const t = useT()
  if (item.kind === 'mapa') {
    return (
      <span className={styles.mapPreview}>
        <span className={styles.mapPreviewRoot}>{item.preview.root}</span>
        <span className={styles.mapPreviewBranches}>
          {item.preview.branches.map((b) => (
            <span key={b} className={styles.mapPreviewBranch}>
              {b}
            </span>
          ))}
        </span>
      </span>
    )
  }
  if (item.kind === 'noticia' && item.preview.outlet) {
    return (
      <span className={styles.outlet}>
        <Icon name="globe" size={14} /> {item.preview.outlet}
      </span>
    )
  }
  return item.preview?.sections ? <span className={styles.outlet}>{t('community.sections', { count: item.preview.sections })}</span> : null
}

export function MaterialCard({ item, because, showStatus }) {
  const t = useT()
  const length = item.kind === 'mapa' ? t('community.nodes', { count: item.preview.nodes }) : t('community.readingTime', { count: item.readingMinutes })
  return (
    <Surface interactive to={itemLink(item)} className={styles.contentCard} data-kind={item.kind}>
      <span className={styles.cardHead}>
        <KindTag kind={item.kind} small />
        <span className={styles.cardLength}>{length}</span>
      </span>
      <span className={styles.deckName}>{item.title}</span>
      {item.excerpt ? <span className={styles.excerpt}>{item.excerpt}</span> : null}
      <Preview item={item} />
      <span className={styles.cardFoot}>
        <span className={styles.cardAuthor}>
          <Avatar name={item.author?.name} />
          <span className={styles.cardAuthorText}>
            <span className={styles.cardAuthorName}>{item.author?.name}</span>
            <span className={styles.cardAuthorMeta}>
              {item.categoryName} · {t('community.via', { client: item.source?.client || 'IA' })}
            </span>
          </span>
        </span>
        {showStatus ? (
          <Chip tone={{ aprovado: 'success', rejeitado: 'danger', privado: 'neutral' }[item.status] || 'warning'}>{t(`community.status.${item.status}`)}</Chip>
        ) : (
          <span className={styles.deckStats}>
            <span className={styles.stat}>
              <Icon name="eye" size={14} />
              {fmtNumber(item.stats.views)} <span className="sr-only">{t('community.viewsLabel')}</span>
            </span>
            <span className={styles.stat}>
              <Icon name="heart" size={14} />
              {fmtNumber(item.stats.favorites)} <span className="sr-only">{t('community.favoritesLabel')}</span>
            </span>
          </span>
        )}
      </span>
      {because ? <span className={styles.deckBecause}>{because}</span> : null}
    </Surface>
  )
}

export function ContentCard({ item, because, showStatus }) {
  if (item.kind === 'flashcards') return <CommunityDeckCard deck={item} because={because} />
  return <MaterialCard item={item} because={because} showStatus={showStatus} />
}
