import styles from './public.module.css'
import { Button, EmptyState, Surface, Wordmark } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'

export function NotFoundPage() {
  const t = useT()
  useDocumentTitle(t('common.notFound.title'))
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Wordmark size={24} to="/" />
      </header>
      <main className={styles.main} id="conteudo">
        <Surface>
          <EmptyState icon="route" title={t('common.notFound.title')} text={t('common.notFound.text')} action={<Button to="/app" icon="book">{t('common.notFound.action')}</Button>} />
        </Surface>
      </main>
    </div>
  )
}
