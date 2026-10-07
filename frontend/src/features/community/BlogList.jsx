import { Link } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Button, Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { fmtDate, fmtNumber } from '../../lib/format.js'

export function BlogList({ posts }) {
  const t = useT()
  return (
    <div className={styles.blog}>
      <div className={styles.blogHead}>
        <div>
          <h2 className={styles.tlHeading}>{t('community.blog.title')}</h2>
          <p className={styles.meta}>{t('community.blog.lead')}</p>
        </div>
        <Button icon="edit" to="/app/perfil/blog/novo">
          {t('community.blog.write')}
        </Button>
      </div>
      {posts.length ? (
        <ol className={styles.blogList}>
          {posts.map((p) => (
            <li key={p.id} className={styles.blogItem}>
              <article className={styles.blogCard}>
                <span className={styles.blogCategory}>{p.categoryName}</span>
                <h3 className={styles.blogTitle}>
                  <Link to={`/app/comunidade/conteudo/${p.id}`} className={styles.tlLink}>
                    {p.title}
                  </Link>
                </h3>
                <p className={styles.blogLead}>{p.description}</p>
                <footer className={styles.blogFoot}>
                  <span className={styles.blogAuthor}>
                    <Avatar name={p.author?.name} />
                    <span className={styles.blogByline}>
                      <span className={styles.blogAuthorName}>{p.author?.name}</span>
                      <span className={styles.meta}>
                        {fmtDate(p.publishedAt)} · {t('community.blog.minutes', { count: p.readingMinutes })}
                        {p.preview?.outlet ? ` · ${p.preview.outlet}` : ''}
                      </span>
                    </span>
                  </span>
                  <span className={styles.blogStats}>
                    <span className={styles.tlStat}>
                      <Icon name="message" size={14} />
                      {p.commentCount} <span className="sr-only">{t('community.deck.comments', { count: p.commentCount })}</span>
                    </span>
                    <span className={styles.tlStat}>
                      <Icon name="eye" size={14} />
                      {fmtNumber(p.stats.views)} <span className="sr-only">{t('community.viewsLabel')}</span>
                    </span>
                    {p.audience === 'seguidores' ? (
                      <span className={styles.audiencePill}>
                        <Icon name="users" size={12} />
                        {t('community.share.audience.seguidores')}
                      </span>
                    ) : null}
                  </span>
                </footer>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.meta}>{t('community.blog.empty')}</p>
      )}
    </div>
  )
}
