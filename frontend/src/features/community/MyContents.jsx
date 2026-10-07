import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './community.module.css'
import { Banner, Button, ChipButton, ConfirmDialog, EmptyState, Icon, Sheet, Skeleton, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtRelative } from '../../lib/format.js'
import { KIND_ICON, KindTag } from './kinds.jsx'

const STATUS_TONE = { aprovado: 'success', rejeitado: 'danger', privado: 'neutral', em_triagem: 'warning', em_revisao: 'warning' }

export function usePublishMaterial(onDone) {
  const t = useT()
  const toast = useToast()
  const [target, setTarget] = useState(null)
  const [audience, setAudience] = useState('comunidade')
  const [busy, setBusy] = useState(false)
  const ask = (material) => {
    setAudience(material?.audience === 'seguidores' ? 'seguidores' : 'comunidade')
    setTarget(material)
  }
  const confirm = async () => {
    setBusy(true)
    try {
      const res = await studentApi.post(`/me/materials/${target.id}/publish`, { acceptPolicy: true, audience })
      toast.show({ message: audience === 'seguidores' ? t('community.share.sharedFollowers') : t('community.mine.published', { hours: res.sla.hours }), icon: 'check' })
      setTarget(null)
      onDone?.(res.material)
    } catch (err) {
      if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
      else toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  const options = [
    { value: 'comunidade', icon: 'globe', title: t('community.share.community'), text: t('community.share.communityText') },
    { value: 'seguidores', icon: 'users', title: t('community.share.followers'), text: t('community.share.followersText') }
  ]
  const dialog = (
    <Sheet
      open={Boolean(target)}
      onClose={() => setTarget(null)}
      title={t('community.share.title')}
      footer={
        <>
          <Button variant="ghost" onClick={() => setTarget(null)}>
            {t('common.actions.cancel')}
          </Button>
          <Button icon="send" onClick={confirm} loading={busy}>
            {audience === 'seguidores' ? t('community.share.confirmFollowers') : t('community.share.confirmCommunity')}
          </Button>
        </>
      }
    >
      <p className={styles.meta}>{t('community.share.lead', { title: target?.title || '' })}</p>
      <div className={styles.audiences} role="radiogroup" aria-label={t('community.share.title')}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={audience === o.value ? 'true' : 'false'} className={styles.audience} onClick={() => setAudience(o.value)}>
            <span className={styles.audienceIcon} aria-hidden="true">
              <Icon name={o.icon} size={20} />
            </span>
            <span className={styles.audienceBody}>
              <span className={styles.audienceTitle}>{o.title}</span>
              <span className={styles.meta}>{o.text}</span>
            </span>
            <span className={styles.audienceCheck} aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
          </button>
        ))}
      </div>
      <p className={styles.meta}>{t('community.share.policy')}</p>
    </Sheet>
  )
  return { ask, dialog }
}

export function useRemoveMaterial(onDone) {
  const t = useT()
  const toast = useToast()
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await studentApi.del(`/me/materials/${target.id}`)
      toast.show({ message: t('community.mine.removed') })
      const removed = target
      setTarget(null)
      onDone?.(removed)
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  const dialog = (
    <ConfirmDialog open={Boolean(target)} onClose={() => setTarget(null)} onConfirm={confirm} title={t('community.mine.removeTitle')} confirmLabel={t('community.mine.remove')} danger loading={busy}>
      <p>{t('community.mine.removeText', { title: target?.title || '' })}</p>
    </ConfirmDialog>
  )
  return { ask: setTarget, dialog }
}

export function useUnpublishMaterial(onDone) {
  const t = useT()
  const toast = useToast()
  return async (material) => {
    try {
      await studentApi.post(`/me/materials/${material.id}/unpublish`)
      toast.show({ message: t('community.share.unshared'), icon: 'eyeOff' })
      onDone?.()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }
}

function itemHref(item) {
  if (item.kind === 'flashcards') return `/app/decks/${item.id}`
  return `/app/comunidade/conteudo/${item.id}`
}

const FILTERS = ['all', 'noticia', 'flashcards', 'resumo', 'mapa']

export function MyContents({ onChanged }) {
  const t = useT()
  const list = useAsync(() => studentApi.get('/me/publications'), [])
  const [filter, setFilter] = useState('all')
  const refresh = () => {
    list.run().catch(() => {})
    onChanged?.()
  }
  const publish = usePublishMaterial(refresh)
  const remove = useRemoveMaterial(refresh)
  const unpublish = useUnpublishMaterial(refresh)
  const items = (list.data?.items || []).filter((i) => filter === 'all' || i.kind === filter)
  const all = list.data?.items || []
  const published = all.filter((i) => i.status === 'aprovado').length

  return (
    <div className={styles.section}>
      <div className={styles.mineHead}>
        <div>
          <h2 className={styles.tlHeading}>{t('community.mine.title')}</h2>
          <p className={styles.meta}>{t('community.mine.summary', { total: all.length, published, followers: list.data?.followers ?? 0 })}</p>
        </div>
        <Button icon="edit" to="/app/perfil/blog/novo">
          {t('community.blog.write')}
        </Button>
      </div>

      <div className={styles.filterOptions} role="group" aria-label={t('community.kindFilter')}>
        {FILTERS.map((k) => (
          <ChipButton key={k} pressed={filter === k} icon={k === 'all' ? 'home' : KIND_ICON[k]} onClick={() => setFilter(k)}>
            {t(`community.kindsPlural.${k}`)} ({k === 'all' ? all.length : all.filter((i) => i.kind === k).length})
          </ChipButton>
        ))}
      </div>

      {list.loading && !list.data ? <Skeleton height={88} count={3} /> : null}
      {list.error && !list.data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={refresh}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {list.data && !items.length ? <EmptyState icon="file" title={t('community.mine.emptyTitle')} text={t('community.mine.empty')} /> : null}

      <ul className={styles.mineRows}>
        {items.map((m) => (
          <li key={`${m.kind}-${m.id}`} className={styles.mineRow} data-kind={m.kind}>
            <span className={styles.mineIcon} aria-hidden="true">
              <Icon name={KIND_ICON[m.kind]} size={18} />
            </span>
            <div className={styles.mineBody}>
              <span className={styles.mineTop}>
                <KindTag kind={m.kind} small />
                <span className={styles.statusPill} data-tone={STATUS_TONE[m.status] || 'neutral'}>
                  {t(`community.status.${m.status}`)}
                </span>
                {m.status === 'aprovado' ? (
                  <span className={styles.audiencePill}>
                    <Icon name={m.audience === 'seguidores' ? 'users' : 'globe'} size={12} />
                    {t(`community.share.audience.${m.audience}`)}
                  </span>
                ) : null}
              </span>
              <Link to={itemHref(m)} className={styles.mineTitle}>
                {m.title}
              </Link>
              <span className={styles.meta}>
                {m.categoryName} · {m.publishedAt ? t('community.mine.publishedAt', { when: fmtRelative(m.publishedAt) }) : t('community.mine.createdAt', { when: fmtRelative(m.createdAt) })}
                {m.kind === 'flashcards' ? ` · ${t('community.cards', { count: m.cardCount })}` : ''}
                {m.kind !== 'flashcards' && m.status === 'aprovado' ? ` · ${fmtNumber(m.stats.views)} ${t('community.viewsLabel')} · ${t('community.deck.comments', { count: m.commentCount })}` : ''}
                {m.kind === 'flashcards' && m.stats ? ` · ${fmtNumber(m.stats.studiedWeek)} ${t('community.studiedLabel')}` : ''}
              </span>
            </div>
            <div className={styles.mineActions}>
              {m.kind === 'flashcards' ? (
                <Button size="small" variant="ghost" to={`/app/decks/${m.id}`}>
                  {m.status === 'privado' || m.status === 'rejeitado' ? t('community.share.openToPublish') : t('common.actions.open')}
                </Button>
              ) : (
                <>
                  {m.kind === 'noticia' && m.status !== 'em_triagem' ? (
                    <Button size="small" variant="ghost" icon="edit" to={`/app/perfil/blog/${m.id}`} label={`${t('common.actions.edit')} ${m.title}`} />
                  ) : null}
                  {m.status === 'privado' || m.status === 'rejeitado' ? (
                    <Button size="small" icon="send" onClick={() => publish.ask(m)}>
                      {t('community.share.cta')}
                    </Button>
                  ) : null}
                  {m.status === 'aprovado' ? (
                    <Button size="small" variant="ghost" icon="eyeOff" onClick={() => unpublish(m)}>
                      {t('community.share.unshare')}
                    </Button>
                  ) : null}
                  <Button size="small" variant="text" icon="trash" onClick={() => remove.ask(m)} label={`${t('community.mine.remove')} ${m.title}`} />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {publish.dialog}
      {remove.dialog}
    </div>
  )
}
