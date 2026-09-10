import { useParams } from 'react-router-dom'
import styles from './public.module.css'
import { Badge, Banner, Button, Chip, Skeleton, Surface, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { publicApi } from '../../lib/api.js'

export function PublicDeckPreview() {
  const t = useT()
  const { publicId } = useParams()
  const preview = useAsync(() => publicApi.get(`/public/decks/${publicId}`), [publicId])
  const p = preview.data?.preview
  useDocumentTitle(p?.name)
  const next = p ? (p.kind === 'community' ? `/app/comunidade/deck/${p.id}` : `/app/comunidade/busca?q=${encodeURIComponent(p.name)}`) : '/app'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Wordmark size={24} to="/" />
      </header>
      <main className={styles.main} id="conteudo">
        {preview.loading && !p ? <Skeleton height={200} /> : null}
        {preview.error ? (
          <Banner tone="danger" icon="alert">
            {t('common.public.notFound')}
          </Banner>
        ) : null}
        {p ? (
          <Surface className={styles.card}>
            <Badge tone="brand" icon="globe">
              {t('common.public.preview')}
            </Badge>
            <h1 className={styles.title}>{p.name}</h1>
            <p className={styles.meta}>
              {t('common.public.by', { author: p.authorName })} · {p.categoryName} · {t(`common.difficulty.${p.difficulty}`)} · {t('common.units.cards', { count: p.cardCount })} · v{p.version}
            </p>
            <ul className={styles.sample}>
              {p.sample.map((front) => (
                <li key={front}>{front}</li>
              ))}
            </ul>
            <div className={styles.chips}>
              <Chip tone="neutral">{t('common.public.more', { count: Math.max(0, p.cardCount - p.sample.length) })}</Chip>
            </div>
            <p className={styles.meta}>{t('common.public.loginToStudy')}</p>
            <Button size="large" icon="play" to={`/entrar?next=${encodeURIComponent(next)}`}>
              {t('common.public.cta')}
            </Button>
            <Button variant="text" to="/criar-conta">
              {t('common.public.create')}
            </Button>
          </Surface>
        ) : null}
      </main>
    </div>
  )
}
