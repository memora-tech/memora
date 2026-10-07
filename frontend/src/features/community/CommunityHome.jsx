import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Badge, Banner, Button, Icon, Input, Skeleton } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtTime } from '../../lib/format.js'
import { KindTabs } from './KindTabs.jsx'
import { MyContents } from './MyContents.jsx'
import { Timeline, dateOf } from './Timeline.jsx'
import { BlogList } from './BlogList.jsx'
import { KIND_ICON } from './kinds.jsx'

const TAB_VALUES = ['all', 'flashcards', 'resumo', 'mapa', 'noticia', 'mine']

export function SearchField({ value, onChange, onSubmit, autoFocus }) {
  const t = useT()
  return (
    <form
      className={styles.searchBar}
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(value)
      }}
    >
      <div className={styles.searchInput}>
        <Icon name="search" size={20} className={styles.searchIcon} />
        <Input aria-label={t('community.search')} placeholder={t('community.searchPlaceholder')} type="search" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} enterKeyHint="search" />
      </div>
    </form>
  )
}

function SideRail({ data }) {
  const t = useT()
  const [rulesOpen, setRulesOpen] = useState(false)
  const recommended = (data.recommendations || []).slice(0, 3)
  return (
    <aside className={styles.tlRail} aria-label={t('community.railLabel')}>
      <section className={styles.railCard} aria-labelledby="rail-ranking">
        <h2 id="rail-ranking" className={styles.railTitle}>
          <Icon name="trophy" size={16} /> {t('community.rankingWeek')}
        </h2>
        <ol className={styles.railList}>
          {data.rankingWeek.slice(0, 5).map((r) => (
            <li key={r.deckId}>
              <Link to={`/app/comunidade/deck/${r.deckId}`} className={styles.railRow}>
                <span className={styles.rankPos} data-top={r.position === 1 ? 'true' : 'false'}>
                  {r.position}
                </span>
                <span className={styles.rankBody}>
                  <span className={styles.railName}>{r.name}</span>
                  <span className={styles.rankMeta}>{t('community.studiedWeek', { count: r.studiedWeek, value: fmtNumber(r.studiedWeek) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <p className={styles.meta}>{t('community.materialized', { time: fmtTime(data.materializedAt) })}</p>
        <Button variant="text" size="small" iconRight={rulesOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen ? 'true' : 'false'}>
          {t('community.rankingRulesToggle')}
        </Button>
        {rulesOpen ? <p className={styles.meta}>{t('community.rankingRules')}</p> : null}
      </section>

      {recommended.length ? (
        <section className={styles.railCard} aria-labelledby="rail-noa">
          <h2 id="rail-noa" className={styles.railTitle}>
            <Badge tone="noa">{t('study.session.noaLabel')}</Badge> {t('community.recommended')}
          </h2>
          <ul className={styles.railList}>
            {recommended.map((d) => (
              <li key={d.id}>
                <Link to={`/app/comunidade/deck/${d.id}`} className={styles.railRow}>
                  <span className={styles.rankKind} data-kind="flashcards" aria-hidden="true">
                    <Icon name="layers" size={16} />
                  </span>
                  <span className={styles.rankBody}>
                    <span className={styles.railName}>{d.name}</span>
                    <span className={styles.rankMeta}>{t('community.recommendedBecause', { deck: d.becauseDeck })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.following.length ? (
        <section className={styles.railCard} aria-labelledby="rail-following">
          <h2 id="rail-following" className={styles.railTitle}>
            <Icon name="users" size={16} /> {t('community.following')}
          </h2>
          <ul className={styles.railList}>
            {data.following.slice(0, 4).map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link to={item.kind === 'flashcards' ? `/app/comunidade/deck/${item.id}` : `/app/comunidade/conteudo/${item.id}`} className={styles.railRow}>
                  <span className={styles.rankKind} data-kind={item.kind} aria-hidden="true">
                    <Icon name={KIND_ICON[item.kind]} size={16} />
                  </span>
                  <span className={styles.rankBody}>
                    <span className={styles.railName}>{item.name || item.title}</span>
                    <span className={styles.rankMeta}>{item.author?.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}

export function CommunityHome() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const feed = useAsync(() => studentApi.get('/community/feed'), [])
  useDocumentTitle(t('community.title'))
  const data = feed.data
  const tab = TAB_VALUES.includes(params.get('tipo')) ? params.get('tipo') : 'all'
  const category = params.get('categoria') || ''

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const goSearch = (value, keepFocus = false) => {
    if (value.trim().length >= 3) navigate(`/app/comunidade/busca?q=${encodeURIComponent(value.trim())}${tab !== 'all' && tab !== 'mine' ? `&kind=${tab}` : ''}${keepFocus ? '&focus=1' : ''}`)
  }

  const counts = data?.counts || {}
  const kindTabs = TAB_VALUES.filter((v) => v !== 'mine').map((value) => ({
    value,
    label: t(`community.kindsPlural.${value}`),
    icon: value === 'all' ? 'home' : KIND_ICON[value],
    count: value === 'all' ? (counts.flashcards || 0) + (counts.resumo || 0) + (counts.mapa || 0) + (counts.noticia || 0) : counts[value]
  }))
  const tabs = [...kindTabs, { value: 'mine', label: t('community.mine.title'), icon: 'user', count: counts.mine }]

  const items = useMemo(() => {
    if (!data || tab === 'mine') return []
    const decks = data.highlights.map((d) => ({ kind: 'flashcards', ...d }))
    const materials = Object.values(data.materials || {}).flat()
    return [...decks, ...materials]
      .filter((i) => tab === 'all' || i.kind === tab)
      .filter((i) => !category || i.categoryId === category)
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
  }, [data, tab, category])

  const categoryName = data?.categories?.find((c) => c.id === category)?.name
  const heading = tab === 'all' ? t('community.timeline.title') : t(`community.kindsPlural.${tab}`)

  return (
    <div className={styles.workspace}>
      <header className={styles.wsHead}>
        <div className={styles.wsHeadText}>
          <span className={styles.eyebrow}>{t('community.eyebrow')}</span>
          <h1 className={styles.screenTitle}>{t('community.title')}</h1>
          <p className={styles.heroLead}>{t('community.subtitle')}</p>
        </div>
        <div className={styles.wsSearch}>
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v)
              if (v.trim().length >= 3) goSearch(v, true)
            }}
            onSubmit={goSearch}
          />
        </div>
      </header>

      <div className={styles.wsBody}>
        <nav className={styles.wsNav} aria-label={t('community.navLabel')}>
          <div className={styles.wsNavGroup}>
            <span className={styles.wsNavLabel}>{t('community.kindTabsLabel')}</span>
            <KindTabs tabs={tabs} value={tab} onChange={(v) => setParam('tipo', v)} label={t('community.kindTabsLabel')} idBase="comunidade" orientation="vertical" />
          </div>

          {data?.categories ? (
            <div className={styles.wsNavGroup}>
              <span className={styles.wsNavLabel} id="cat-label">
                {t('community.filters.category')}
              </span>
              <ul className={styles.catList} aria-labelledby="cat-label">
                <li>
                  <button type="button" className={styles.catItem} aria-pressed={!category ? 'true' : 'false'} onClick={() => setParam('categoria', '')}>
                    {t('community.filters.all')}
                  </button>
                </li>
                {data.categories.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={styles.catItem} aria-pressed={category === c.id ? 'true' : 'false'} onClick={() => setParam('categoria', category === c.id ? '' : c.id)}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data?.creatorOfMonth ? (
            <Link to={`/app/comunidade/autor/${data.creatorOfMonth.id}`} className={styles.creatorMini}>
              <Avatar name={data.creatorOfMonth.name} />
              <span className={styles.creatorMiniText}>
                <span className={styles.wsNavLabel}>{t('community.creatorOfMonth')}</span>
                <span className={styles.rankName}>{data.creatorOfMonth.name}</span>
                <span className={styles.rankMeta}>{t('community.deck.followers', { count: data.creatorOfMonth.followers })}</span>
              </span>
            </Link>
          ) : null}
        </nav>

        <div role="tabpanel" id="comunidade-panel" aria-labelledby={`comunidade-tab-${tab}`} tabIndex={0} className={styles.wsContent}>
          {tab === 'mine' ? (
            <MyContents onChanged={() => feed.run().catch(() => {})} />
          ) : (
            <>
              {feed.loading && !data ? <Skeleton height={96} count={4} /> : null}
              {feed.error && !data ? (
                <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => feed.run()}>{t('common.actions.retry')}</Button>}>
                  {t('common.state.error')}
                </Banner>
              ) : null}
              {data ? (
                <div className={styles.tlLayout}>
                  {tab === 'noticia' ? (
                    <div className={styles.tlMain}>
                      <BlogList posts={items} />
                    </div>
                  ) : (
                    <div className={styles.tlMain}>
                      <div className={styles.tlHeader}>
                        <h2 className={styles.tlHeading}>
                          {heading}
                          {categoryName ? <span className={styles.meta}> · {categoryName}</span> : null}
                        </h2>
                        <span className={styles.meta}>{t('community.timeline.count', { count: items.length })}</span>
                      </div>
                      <Timeline items={items} emptyText={category ? t('community.categoryEmpty') : t('community.kindEmpty', { kind: heading.toLowerCase() })} />
                    </div>
                  )}
                  <SideRail data={data} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
