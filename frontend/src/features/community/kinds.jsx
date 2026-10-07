import styles from './community.module.css'
import { Icon } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'

export const KINDS = ['flashcards', 'resumo', 'mapa', 'noticia']

export const KIND_ICON = { flashcards: 'layers', resumo: 'file', mapa: 'mindmap', noticia: 'news' }

export const itemLink = (item) => (item.kind === 'flashcards' ? `/app/comunidade/deck/${item.id}` : `/app/comunidade/conteudo/${item.id}`)

export function KindTag({ kind, small }) {
  const t = useT()
  return (
    <span className={[styles.kindTag, small && styles.kindTagSmall].filter(Boolean).join(' ')} data-kind={kind}>
      <Icon name={KIND_ICON[kind]} size={small ? 14 : 16} />
      {t(`community.kinds.${kind}`)}
    </span>
  )
}
