export function lengthOf(t, item) {
  if (item.kind === 'mapa') return t('community.nodes', { count: item.preview.nodes })
  if (item.kind === 'quiz') return t('community.questions', { count: item.preview.questions })
  if (item.kind === 'linha') return t('community.events', { count: item.preview.events })
  return t('community.readingTime', { count: item.readingMinutes })
}
