import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Banner, Button, Chip, Icon, OverflowMenu, PageHeader, Segmented, Sheet, Skeleton, Surface, Textarea, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { KindTag } from './kinds.jsx'
import { Markdown } from './Markdown.jsx'
import { MindMap } from './MindMap.jsx'
import { MaterialCard } from './ContentCard.jsx'
import { usePublishMaterial, useRemoveMaterial, useUnpublishMaterial } from './MyContents.jsx'
import { CommentsPanel } from './Comments.jsx'
import { MapCanvas, MapDiagram } from './MapViews.jsx'
import { RemixBadge, RemixList } from './Remix.jsx'
import { TransformSheet } from '../noa/AiFormats.jsx'
import { QuizView, TimelineView } from './QuizTimeline.jsx'
import { lengthOf } from './lengthOf.js'

export function MaterialView() {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const { materialId } = useParams()
  const detail = useAsync(() => studentApi.get(`/community/materials/${materialId}`), [materialId])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportDetail, setReportDetail] = useState('')
  const [transformOpen, setTransformOpen] = useState(false)
  const [view, setView] = useState(null)
  const data = detail.data
  const m = data?.material
  useDocumentTitle(m ? m.title : t('community.title'))
  const refresh = () => detail.run().catch(() => {})
  const publish = usePublishMaterial(refresh)
  const remove = useRemoveMaterial(() => navigate('/app/comunidade?tipo=mine', { replace: true }))
  const unpublish = useUnpublishMaterial(refresh)

  const patchMaterial = (patch) => detail.setData({ ...data, material: { ...m, ...patch } })

  const favorite = async () => {
    try {
      const res = await studentApi.post(`/community/materials/${m.id}/favorite`)
      patchMaterial({
        viewer: { ...m.viewer, favorited: res.favorited },
        stats: { ...m.stats, favorites: res.favorites }
      })
      toast.show({
        message: res.favorited ? t('community.material.favoriteToast') : t('community.material.unfavoriteToast'),
        icon: 'heart'
      })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const react = async (emoji) => {
    try {
      const res = await studentApi.post(`/community/materials/${m.id}/react`, {
        emoji
      })
      patchMaterial({
        reactions: res.reactions,
        viewer: { ...m.viewer, myReactions: res.mine }
      })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  const report = async (reason) => {
    try {
      const res = await studentApi.post(`/community/materials/${m.id}/report`, {
        reason,
        detail: reportDetail || null
      })
      setReportOpen(false)
      setReportDetail('')
      toast.show({ message: res.message, icon: 'flag' })
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (detail.loading && !data) return <Skeleton height={160} count={3} />
  if (detail.error && !data) {
    return (
      <Banner
        tone="danger"
        icon="alert"
        action={
          <Button size="small" variant="soft" onClick={refresh}>
            {t('common.actions.retry')}
          </Button>
        }
      >
        {detail.error.status === 404 ? t('community.material.notFound') : t('common.state.error')}
      </Banner>
    )
  }
  if (!m) return null

  const published = m.status === 'aprovado'
  const mapView = view || (m.kind === 'mapa' && m.body?.layout === 'diagrama' ? 'diagrama' : 'mapa')
  const body = m.body
  const sources = body.sources || []
  const menu = [
    published && !m.isMine
      ? {
          key: 'report',
          icon: 'flag',
          label: t('community.deck.report'),
          danger: true,
          onSelect: () => setReportOpen(true)
        }
      : null,
    m.isMine && published
      ? {
          key: 'unshare',
          icon: 'eyeOff',
          label: t('community.share.unshare'),
          onSelect: () => unpublish(m)
        }
      : null,
    m.isMine
      ? {
          key: 'remove',
          icon: 'trash',
          label: t('community.mine.remove'),
          danger: true,
          onSelect: () => remove.ask(m)
        }
      : null
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      <PageHeader title={m.title} backTo="/app/comunidade" backLabel={t('community.title')} actions={menu.length ? <OverflowMenu label={t('common.actions.more')} items={menu} /> : null}>
        {m.kind === 'noticia' ? null : m.description || null}
      </PageHeader>

      <div className={styles.deckMeta}>
        <KindTag kind={m.kind} />
        <Chip tone="brand">{m.categoryName}</Chip>
        <Chip tone="neutral" icon="clock">
          {lengthOf(t, m)}
        </Chip>
        {m.lang !== 'pt-BR' ? (
          <Chip tone="brand" icon="globe">
            {t('community.lang', { lang: t(`community.langNames.${m.lang}`) })}
          </Chip>
        ) : null}
        {m.isMine ? <Chip tone={{ aprovado: 'success', rejeitado: 'danger', privado: 'neutral' }[m.status] || 'warning'}>{t(`community.status.${m.status}`)}</Chip> : null}
        {published ? (
          <Chip tone="neutral" icon={m.audience === 'seguidores' ? 'users' : 'globe'}>
            {t(`community.share.audience.${m.audience}`)}
          </Chip>
        ) : null}
      </div>

      {m.remixOf ? <RemixBadge remixOf={m.remixOf} /> : null}

      {data.moderation?.status === 'rejeitado' ? (
        <Banner tone="danger" icon="alert">
          {t('community.material.moderationRejected', {
            reason: data.moderation.decision?.reasonCategory || '—',
            excerpt: data.moderation.decision?.excerpt || ''
          })}
        </Banner>
      ) : data.moderation && !published ? (
        <Banner tone="warning" icon="clock">
          {t('community.material.moderationPending', {
            when: fmtRelative(data.moderation.submittedAt),
            hours: data.moderation.slaHours
          })}
        </Banner>
      ) : m.aiGenerated ? (
        <Banner tone="neutral" icon="sparkle">
          {m.isMine && !published
            ? t('community.material.aiNoticeOwn', {
                client: m.source?.client || 'IA'
              })
            : t('community.material.aiNotice')}
        </Banner>
      ) : null}

      {m.isMine && m.status !== 'em_triagem' ? (
        <div className={styles.ownerBar}>
          {m.status === 'privado' || m.status === 'rejeitado' ? (
            <Button icon="send" onClick={() => publish.ask(m)}>
              {t('community.share.cta')}
            </Button>
          ) : null}
          {m.kind === 'noticia' && m.status !== 'em_triagem' ? (
            <Button variant="ghost" icon="edit" to={`/app/perfil/blog/${m.id}`}>
              {t('community.material.editPost')}
            </Button>
          ) : null}
          {published ? (
            <Button variant="ghost" icon="eyeOff" onClick={() => unpublish(m)}>
              {t('community.share.unshare')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {m.author ? (
        <Surface className={styles.authorRow}>
          {published && !m.isMine ? (
            <Link to={`/app/comunidade/autor/${m.author.id}`} className={styles.authorLink}>
              <Avatar name={m.author.name} />
              <span className={styles.authorBody}>
                <span className={styles.authorName}>{m.author.name}</span>
                <span className={styles.authorMeta}>{m.aiGenerated ? t('community.via', { client: m.source?.client || 'IA' }) : t('community.material.writtenBy')}</span>
              </span>
            </Link>
          ) : (
            <span className={styles.authorLink}>
              <Avatar name={m.author.name} />
              <span className={styles.authorBody}>
                <span className={styles.authorName}>{m.author.name}</span>
                <span className={styles.authorMeta}>{m.aiGenerated ? t('community.via', { client: m.source?.client || 'IA' }) : t('community.material.writtenBy')}</span>
              </span>
            </span>
          )}
          {published ? (
            <Button
              size="small"
              variant="ghost"
              icon="message"
              onClick={() => {
                const el = document.getElementById('comentarios')
                el?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                  block: 'start'
                })
                el?.querySelector('textarea')?.focus({ preventScroll: true })
              }}
            >
              {t('community.deck.comments', { count: m.commentCount })}
            </Button>
          ) : null}
          {published ? (
            <Button size="small" variant="ghost" icon="sparkle" onClick={() => setTransformOpen(true)}>
              {t('ai.transform.action')}
            </Button>
          ) : null}
          {published ? (
            <Button size="small" variant={m.viewer.favorited ? 'soft' : 'ghost'} icon="heart" aria-pressed={m.viewer.favorited ? 'true' : 'false'} onClick={favorite}>
              {m.viewer.favorited ? t('community.material.favorited') : t('community.material.favorite')}
            </Button>
          ) : null}
        </Surface>
      ) : null}

      <article className={styles.article} data-kind={m.kind}>
        {m.kind === 'noticia' ? (
          <>
            <p className={styles.lead}>{m.description}</p>
            <Markdown text={body.markdown} />
            {body.url ? (
              <Button variant="soft" icon="external" href={body.url} target="_blank" rel="noopener noreferrer">
                {t('community.material.original', {
                  outlet: body.outlet || new URL(body.url).hostname
                })}
              </Button>
            ) : null}
          </>
        ) : m.kind === 'quiz' ? (
          <QuizView questions={body.questions} materialId={m.id} viewerQuiz={m.viewer?.quiz} />
        ) : m.kind === 'linha' ? (
          <TimelineView events={body.events} />
        ) : m.kind === 'mapa' ? (
          <div className={styles.mapViews}>
            <div className={styles.mapViewBar}>
              <Segmented
                label={t('community.mapviews.label')}
                value={mapView}
                onChange={setView}
                options={[
                  {
                    value: 'mapa',
                    label: t('community.mapviews.map'),
                    icon: 'mindmap'
                  },
                  {
                    value: 'diagrama',
                    label: t('community.mapviews.diagram'),
                    icon: 'route'
                  }
                ]}
              />
            </div>
            {mapView === 'diagrama' ? (
              <MapDiagram root={body.root} />
            ) : (
              <>
                <MapCanvas root={body.root} />
                <MindMap root={body.root} />
              </>
            )}
          </div>
        ) : (
          <Markdown text={body.markdown} />
        )}
      </article>

      {sources.length ? (
        <section className={styles.section} aria-labelledby="sec-fontes">
          <h2 id="sec-fontes" className={styles.sectionTitle}>
            {t('community.material.sources')}
          </h2>
          <ul className={styles.sources}>
            {sources.map((s) => (
              <li key={`${s.title}-${s.url}`}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} <Icon name="external" size={14} />
                  </a>
                ) : (
                  s.title
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {published ? (
        <Surface>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 12 }}>
            {t('community.deck.reactions')}
          </h2>
          <div className={styles.reactions} role="group" aria-label={t('community.deck.reactions')}>
            {data.reactionsList.map((emoji) => {
              const count = m.reactions[emoji] || 0
              const mine = m.viewer.myReactions.includes(emoji)
              return (
                <button key={emoji} type="button" className={styles.reaction} aria-pressed={mine ? 'true' : 'false'} aria-label={t(mine ? 'community.deck.reactRemove' : 'community.deck.react', { emoji, count })} onClick={() => react(emoji)}>
                  <span aria-hidden="true">{emoji}</span>
                  <span className="tabnum">{fmtNumber(count)}</span>
                </button>
              )
            })}
          </div>
        </Surface>
      ) : null}

      {published ? (
        <Surface id="comentarios" className={styles.commentsBlock}>
          <CommentsPanel basePath={`/community/materials/${m.id}`} authorId={m.authorId} />
        </Surface>
      ) : null}

      <RemixList remixes={data.remixes} />

      {data.related.length ? (
        <section className={styles.section} aria-labelledby="sec-rel">
          <h2 id="sec-rel" className={styles.sectionTitle}>
            {t('community.material.related')}
          </h2>
          <div className={styles.grid}>
            {data.related.map((r) => (
              <MaterialCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      ) : null}

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title={t('community.material.reportTitle')}>
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
      <TransformSheet open={transformOpen} item={m} onClose={() => setTransformOpen(false)} />
      {publish.dialog}
      {remove.dialog}
    </div>
  )
}
