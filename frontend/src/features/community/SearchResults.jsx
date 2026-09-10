import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './community.module.css'
import { Banner, Button, ChipButton, Icon, Segmented, Sheet, Skeleton } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { CommunityDeckCard } from './CommunityDeckCard.jsx'
import { SearchField } from './CommunityHome.jsx'

const MIN_CHARS = 3

export function SearchResults() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const difficulty = params.get('difficulty') || ''
  const sort = params.get('sort') || 'relevance'
  const approved = params.get('approved') === '1'
  const [input, setInput] = useState(q)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  useDocumentTitle(q ? `${t('community.title')} · ${q}` : t('community.title'))

  useEffect(() => {
    setInput(q)
  }, [q])

  useEffect(() => {
    if (q.trim().length < MIN_CHARS) {
      setData(null)
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ q, category, difficulty, sort })
      if (approved) query.set('approved', '1')
      studentApi
        .get(`/community/search?${query.toString()}`)
        .then((d) => alive && setData(d))
        .catch((err) => alive && setError(err))
        .finally(() => alive && setLoading(false))
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, category, difficulty, sort, approved])

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    next.delete('focus')
    setParams(next, { replace: true })
  }

  const categories = data?.filters?.categories || []
  const categoryName = categories.find((c) => c.id === category)?.name || category
  const active = [
    category ? { key: 'category', label: categoryName, clear: { category: '' } } : null,
    difficulty ? { key: 'difficulty', label: t(`common.difficulty.${difficulty}`), clear: { difficulty: '' } } : null,
    approved ? { key: 'approved', label: t('community.filters.approved'), clear: { approved: '' } } : null,
    sort !== 'relevance' ? { key: 'sort', label: t(`community.sorts.${sort}`), clear: { sort: '' } } : null
  ].filter(Boolean)

  const results = data?.results || []
  const short = q.trim().length > 0 && q.trim().length < MIN_CHARS

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('community.title')}</h1>
      <SearchField value={input} onChange={(v) => { setInput(v); update({ q: v }) }} onSubmit={(v) => update({ q: v })} autoFocus={params.get('focus') === '1'} />

      {q.trim().length >= MIN_CHARS ? (
        <div className={styles.filterBar}>
          <Button size="small" variant={active.length ? 'soft' : 'ghost'} icon="filter" onClick={() => setFiltersOpen(true)}>
            {active.length ? `${t('community.filters.open')} · ${active.length}` : t('community.filters.open')}
          </Button>
          {active.length ? (
            <div className={styles.activeFilters}>
              {active.map((f) => (
                <span key={f.key} className={styles.filterChip}>
                  {f.label}
                  <Button variant="text" size="small" icon="x" label={t('community.filters.remove', { name: f.label })} onClick={() => update(f.clear)} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.section}>
          <p className={styles.meta}>{short ? t('community.searchMinChars') : t('community.typeToSearch')}</p>
          <div className={styles.sectionFooter}>
            <Button variant="ghost" icon="arrowLeft" to="/app/comunidade">
              {t('community.backToFeed')}
            </Button>
          </div>
        </div>
      )}

      {loading && !data ? <Skeleton height={110} count={3} /> : null}
      {error ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => update({ q })}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}
      {data ? (
        <>
          <p className={styles.meta} role="status">
            {results.length ? t('community.searchResults', { count: results.length, q }) : t('community.noResults', { q })}
          </p>
          <div className={styles.grid}>
            {results.map((d) => (
              <CommunityDeckCard key={d.id} deck={d} />
            ))}
          </div>
        </>
      ) : null}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('community.filters.title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => { update({ category: '', difficulty: '', approved: '', sort: '' }); setFiltersOpen(false) }}>
              {t('community.filters.clear')}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>{t('community.filters.apply')}</Button>
          </>
        }
      >
        <div className={styles.filterSheet}>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel} id="f-cat">
              {t('community.filters.category')}
            </span>
            <div className={styles.filterOptions} role="group" aria-labelledby="f-cat">
              <ChipButton pressed={!category} onClick={() => update({ category: '' })}>
                {t('community.filters.all')}
              </ChipButton>
              {categories.map((c) => (
                <ChipButton key={c.id} pressed={category === c.id} onClick={() => update({ category: category === c.id ? '' : c.id })}>
                  {c.name}
                </ChipButton>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel} id="f-dif">
              {t('community.filters.difficulty')}
            </span>
            <div className={styles.filterOptions} role="group" aria-labelledby="f-dif">
              {['facil', 'medio', 'dificil'].map((d) => (
                <ChipButton key={d} pressed={difficulty === d} onClick={() => update({ difficulty: difficulty === d ? '' : d })}>
                  {t(`common.difficulty.${d}`)}
                </ChipButton>
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <ChipButton pressed={approved} icon="shield" onClick={() => update({ approved: approved ? '' : '1' })}>
              {t('community.filters.approved')}
            </ChipButton>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupLabel}>{t('community.filters.sort')}</span>
            <Segmented label={t('community.filters.sort')} value={sort} onChange={(v) => update({ sort: v })} options={['relevance', 'recent', 'rating'].map((s) => ({ value: s, label: t(`community.sorts.${s}`) }))} />
          </div>
        </div>
      </Sheet>
    </div>
  )
}
