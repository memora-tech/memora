import { Link } from 'react-router-dom'
import styles from './screen.module.css'
import { Icon } from './Icon.jsx'
import { useT } from '../i18n/index.js'

export function Screen({ children, className, fill }) {
  return <div className={[styles.screen, fill && styles.screenFill, className].filter(Boolean).join(' ')}>{children}</div>
}

export function Breadcrumbs({ items }) {
  const t = useT()
  if (!items?.length) return null
  return (
    <nav aria-label={t('common.nav.breadcrumbs')} className={styles.crumbs}>
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`}>
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined} className={styles.crumbCurrent}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className={styles.crumbLink}>
                  {i === 0 ? <Icon name="arrowLeft" size={14} /> : null}
                  {item.label}
                </Link>
              )}
              {!last ? (
                <span className={styles.crumbSep} aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function ScreenHeader({ eyebrow, title, lead, actions, titleId, crumbs }) {
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        <Breadcrumbs items={crumbs} />
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  )
}

export function QACard({ index, question, answer, meta, action, as = 'article' }) {
  const t = useT()
  const Tag = as
  return (
    <Tag className={styles.qa}>
      <span className={styles.qaNum} aria-hidden="true">
        {index}
      </span>
      <div className={styles.qaBody}>
        <div className={styles.qaSide}>
          <span className={styles.qaLabel}>
            <span className="sr-only">{index}. </span>
            {t('common.nav.question')}
          </span>
          <span className={styles.qaQuestion}>{question}</span>
        </div>
        <div className={styles.qaSide}>
          <span className={styles.qaLabel}>{t('common.nav.answer')}</span>
          <span className={styles.qaAnswer}>{answer}</span>
        </div>
      </div>
      {meta || action ? (
        <div className={styles.qaFoot}>
          <span className={styles.qaMeta}>{meta}</span>
          {action}
        </div>
      ) : null}
    </Tag>
  )
}

export function StatRow({ children }) {
  return <div className={styles.stats}>{children}</div>
}

export function StatTile({ label, value, note, icon, tone }) {
  return (
    <div className={styles.tile} data-tone={tone || 'plain'}>
      <span className={styles.tileLabel}>
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </span>
      <span className={`${styles.tileValue} tabnum`}>{value}</span>
      {note ? <span className={styles.tileNote}>{note}</span> : null}
    </div>
  )
}

export function Panel({ title, icon, action, children, className, bodyClassName, as = 'section', labelledBy }) {
  const Tag = as
  return (
    <Tag className={[styles.panel, className].filter(Boolean).join(' ')} aria-labelledby={title ? labelledBy : undefined}>
      {title ? (
        <header className={styles.panelHead}>
          <h2 id={labelledBy} className={styles.panelTitle}>
            {icon ? <Icon name={icon} size={18} /> : null}
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      <div className={[styles.panelBody, bodyClassName].filter(Boolean).join(' ')}>{children}</div>
    </Tag>
  )
}
