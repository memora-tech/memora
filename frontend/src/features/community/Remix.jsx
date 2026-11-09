import { Link } from 'react-router-dom'
import styles from './community.module.css'
import { Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { itemLink } from './kinds.jsx'

export function RemixBadge({ remixOf, compact }) {
  const t = useT()
  if (!remixOf) return null
  return (
    <Link to={itemLink(remixOf)} className={[styles.remix, compact && styles.remixCompact].filter(Boolean).join(' ')}>
      <Icon name="refresh" size={14} />
      <span>{compact ? t('community.remix.short', { author: remixOf.authorName || '—' }) : t('community.remix.of', { title: remixOf.title, author: remixOf.authorName || '—', kind: t(`community.kinds.${remixOf.kind}`).toLowerCase() })}</span>
    </Link>
  )
}

export function RemixList({ remixes }) {
  const t = useT()
  if (!remixes?.length) return null
  return (
    <section className={styles.remixSection} aria-labelledby="sec-remixes">
      <header className={styles.remixSectionHead}>
        <h2 id="sec-remixes" className={styles.sectionTitle}>
          <Icon name="refresh" size={18} /> {t('community.remix.listTitle', { count: remixes.length })}
        </h2>
        <p className={styles.meta}>{t('community.remix.listLead')}</p>
      </header>
      <ul className={styles.remixGrid}>
        {remixes.map((r) => (
          <li key={r.id}>
            <Link to={itemLink(r)} className={styles.remixCard} data-kind={r.kind}>
              <span className={styles.remixKind}>
                {t(`community.kinds.${r.kind}`)}
                {r.preview?.layout === 'diagrama' ? ` · ${t('ai.formats.diagrama.label')}` : ''}
              </span>
              <span className={styles.remixTitle}>{r.title}</span>
              <span className={styles.meta}>{t('community.remix.by', { author: r.author?.name || '—', client: r.source?.client || 'IA' })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
