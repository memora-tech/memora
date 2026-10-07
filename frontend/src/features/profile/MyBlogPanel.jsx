import { Link } from 'react-router-dom'
import styles from './profile.module.css'
import { Button, EmptyState, Icon, Panel, Skeleton } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { usePublishMaterial } from '../community/MyContents.jsx'

const STATUS_TONE = { aprovado: 'success', rejeitado: 'danger', privado: 'neutral', em_triagem: 'warning' }

export function MyBlogPanel() {
  const t = useT()
  const list = useAsync(() => studentApi.get('/me/materials'), [])
  const publish = usePublishMaterial(() => list.run().catch(() => {}))
  const posts = (list.data?.items || []).filter((m) => m.kind === 'noticia')

  return (
    <section id="meu-blog" className={styles.blogPanelWrap}>
      <Panel
        title={t('profile.blog.title')}
        icon="news"
        labelledBy="meu-blog-titulo"
        action={
          <Button size="small" icon="edit" to="/app/perfil/blog/novo">
            {t('profile.blog.write')}
          </Button>
        }
      >
        <p className={styles.meta}>{t('profile.blog.lead')}</p>
        {list.loading && !list.data ? <Skeleton height={64} count={2} /> : null}
        {list.data && !posts.length ? <EmptyState icon="news" title={t('profile.blog.emptyTitle')} text={t('profile.blog.empty')} action={<Button icon="edit" to="/app/perfil/blog/novo">{t('profile.blog.write')}</Button>} /> : null}
        <ul className={styles.blogRows}>
          {posts.map((p) => (
            <li key={p.id} className={styles.blogRow}>
              <div className={styles.blogRowBody}>
                <Link to={`/app/comunidade/conteudo/${p.id}`} className={styles.blogRowTitle}>
                  {p.title}
                </Link>
                <span className={styles.meta}>{p.description}</span>
                <span className={styles.blogRowMeta}>
                  <span className={styles.pill} data-tone={STATUS_TONE[p.status] || 'neutral'}>
                    {t(`community.status.${p.status}`)}
                  </span>
                  {p.status === 'aprovado' ? (
                    <span className={styles.pill} data-tone="brand">
                      <Icon name={p.audience === 'seguidores' ? 'users' : 'globe'} size={12} />
                      {t(`community.share.audience.${p.audience}`)}
                    </span>
                  ) : null}
                  <span>{p.publishedAt ? t('community.mine.publishedAt', { when: fmtRelative(p.publishedAt) }) : t('community.mine.createdAt', { when: fmtRelative(p.createdAt) })}</span>
                  {p.status === 'aprovado' ? <span>{`${fmtNumber(p.stats.views)} ${t('community.viewsLabel')} · ${t('community.deck.comments', { count: p.commentCount })}`}</span> : null}
                </span>
              </div>
              <div className={styles.blogRowActions}>
                {p.status !== 'em_triagem' ? (
                  <Button size="small" variant="ghost" icon="edit" to={`/app/perfil/blog/${p.id}`} label={`${t('common.actions.edit')} ${p.title}`} />
                ) : null}
                {p.status === 'privado' || p.status === 'rejeitado' ? (
                  <Button size="small" icon="send" onClick={() => publish.ask(p)}>
                    {t('community.share.cta')}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <Link to="/app/comunidade?tipo=mine" className={styles.allLink}>
          {t('profile.blog.allPublications')} <Icon name="arrowRight" size={14} />
        </Link>
      </Panel>
      {publish.dialog}
    </section>
  )
}
