import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import styles from './community.module.css'
import home from './home.module.css'
import { FEATURES } from '../../config/features.js'
import { Avatar, Badge, Banner, Button, Icon, Input, Segmented, Skeleton } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtTime } from '../../lib/format.js'
import { useSession } from '../../state/SessionContext.jsx'
import { MyContents } from './MyContents.jsx'
import { Timeline, dateOf } from './Timeline.jsx'
import { BlogList } from './BlogList.jsx'
import { KIND_ICON } from './kinds.jsx'
import { CreatorFeature, PulseBar, Spotlight, TopicCloud, pulseOf } from './CommunityPulse.jsx'
import { TransformSheet } from '../noa/AiFormats.jsx'

const TAB_VALUES = FEATURES.materials ? ['all', 'flashcards', 'resumo', 'mapa', 'quiz', 'linha', 'noticia', 'mine'] : ['all', 'flashcards']

const engagement = (i) => {
  const reactions = Object.values(i.reactions || {}).reduce((s, n) => s + n, 0)
  return reactions + (i.commentCount || 0) * 8 + (i.stats?.studiedWeek || 0) + (i.stats?.views || 0) / 4 + (i.stats?.favorites || 0)
}

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

function FilterTabs({ tabs, value, onChange }) {
  const t = useT()
  const refs = useRef({})
  const move = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    onChange(tab.value)
    refs.current[tab.value]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('community.kindTabsLabel')} className={home.chips}>
      {tabs.map((tab, i) => {
        const selected = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[tab.value] = el
            }}
            type="button"
            role="tab"
            id={`comunidade-tab-${tab.value}`}
            aria-selected={selected ? 'true' : 'false'}
            aria-controls="comunidade-panel"
            tabIndex={selected ? 0 : -1}
            className={home.chip}
            data-kind={tab.value === 'all' || tab.value === 'mine' ? undefined : tab.value}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1)
              else if (e.key === 'ArrowLeft') move(i - 1)
              else if (e.key === 'Home') move(0)
              else if (e.key === 'End') move(tabs.length - 1)
              else return
              e.preventDefault()
            }}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
            {tab.count !== undefined ? <span className={home.chipCount}>{tab.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function ShareBox() {
  const t = useT()
  const session = useSession()
  return (
    <div className={home.share}>
      <Avatar name={session.user?.name} />
      <Link to={FEATURES.materials ? '/app/perfil/blog/novo' : '/app/decks'} className={home.shareField}>
        {t('community.feed.sharePrompt', {
          name: session.user?.name?.split(' ')[0] || ''
        })}
      </Link>
      <div className={home.shareActions}>
        {FEATURES.materials ? (
          <Link to="/app/perfil/blog/novo" className={home.shareAction} data-kind="noticia">
            <Icon name="edit" size={16} /> <span>{t('community.feed.shareBlog')}</span>
          </Link>
        ) : null}
        <Link to="/app/decks" className={home.shareAction} data-kind="flashcards">
          <Icon name="layers" size={16} /> <span>{t('community.feed.shareDeck')}</span>
        </Link>
        {FEATURES.mcp ? (
          <Link to="/app/noa" className={home.shareAction} data-kind="quiz">
            <Icon name="sparkle" size={16} /> <span>{t('community.feed.shareAi')}</span>
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function GroupsCard({ groups }) {
  const t = useT()
  return (
    <section className={home.railCard} aria-labelledby="rail-groups">
      <div className={home.railHead}>
        <h2 id="rail-groups" className={home.railTitle}>
          <Icon name="users" size={16} /> {t('community.groups.navTitle')}
        </h2>
        <Link to="/app/comunidade/grupos" className={home.railLink}>
          {t('community.feed.seeAll')}
        </Link>
      </div>
      {groups.length ? (
        <ul className={home.groupList}>
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/app/comunidade/grupos/${g.id}`} className={home.groupRow} data-color={g.color}>
                <span className={home.groupMark} aria-hidden="true">
                  {g.name.slice(0, 1)}
                </span>
                <span className={home.groupText}>
                  <span className={home.groupName}>{g.name}</span>
                  <span className={home.groupMeta}>
                    {t('community.groups.membersCount', {
                      value: fmtNumber(g.memberCount)
                    })}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={home.railText}>{t('community.feed.noGroups')}</p>
      )}
      <Button variant="soft" size="small" icon="plus" to="/app/comunidade/grupos" block>
        {t('community.groups.explore')}
      </Button>
    </section>
  )
}

function SideRail({ data, allItems, groups }) {
  const t = useT()
  const [rulesOpen, setRulesOpen] = useState(false)
  const recommended = (data.recommendations || []).slice(0, 3)
  return (
    <aside className={home.rail} aria-label={t('community.railLabel')}>
      {FEATURES.studyGroups ? <GroupsCard groups={groups} /> : null}
      {FEATURES.rankings ? <CreatorFeature creator={data.creatorOfMonth} /> : null}
      {FEATURES.rankings && data.rankingWeek?.length ? (
        <section className={home.railCard} aria-labelledby="rail-ranking">
          <h2 id="rail-ranking" className={home.railTitle}>
            <Icon name="trophy" size={16} /> {t('community.rankingWeek')}
          </h2>
          <ol className={home.rank}>
            {data.rankingWeek.slice(0, 5).map((r) => (
              <li key={r.deckId}>
                <Link to={`/app/comunidade/deck/${r.deckId}`} className={home.rankRow}>
                  <span className={home.rankPos} data-top={r.position <= 3 ? String(r.position) : 'no'}>
                    {r.position}
                  </span>
                  <span className={home.groupText}>
                    <span className={home.groupName}>{r.name}</span>
                    <span className={home.groupMeta}>
                      {t('community.studiedWeek', {
                        count: r.studiedWeek,
                        value: fmtNumber(r.studiedWeek)
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <button type="button" className={home.rulesToggle} onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen ? 'true' : 'false'}>
            {t('community.rankingRulesToggle')} <Icon name={rulesOpen ? 'chevronUp' : 'chevronDown'} size={14} />
          </button>
          {rulesOpen ? (
            <p className={home.railText}>
              {t('community.rankingRules')}{' '}
              {t('community.materialized', {
                time: fmtTime(data.materializedAt)
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {recommended.length ? (
        <section className={home.railCard} aria-labelledby="rail-noa">
          <h2 id="rail-noa" className={home.railTitle}>
            <Badge tone="noa">{t('study.session.noaLabel')}</Badge> {t('community.recommended')}
          </h2>
          <ul className={home.groupList}>
            {recommended.map((d) => (
              <li key={d.id}>
                <Link to={`/app/comunidade/deck/${d.id}`} className={home.groupRow}>
                  <span className={home.kindMark} data-kind="flashcards" aria-hidden="true">
                    <Icon name="layers" size={16} />
                  </span>
                  <span className={home.groupText}>
                    <span className={home.groupName}>{d.name}</span>
                    <span className={home.groupMeta}>
                      {t('community.recommendedBecause', {
                        deck: d.becauseDeck
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.following.length ? (
        <section className={home.railCard} aria-labelledby="rail-following">
          <h2 id="rail-following" className={home.railTitle}>
            <Icon name="user" size={16} /> {t('community.following')}
          </h2>
          <ul className={home.groupList}>
            {data.following.slice(0, 4).map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link to={item.kind === 'flashcards' ? `/app/comunidade/deck/${item.id}` : `/app/comunidade/conteudo/${item.id}`} className={home.groupRow}>
                  <span className={home.kindMark} data-kind={item.kind} aria-hidden="true">
                    <Icon name={KIND_ICON[item.kind]} size={16} />
                  </span>
                  <span className={home.groupText}>
                    <span className={home.groupName}>{item.name || item.title}</span>
                    <span className={home.groupMeta}>{item.author?.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TopicCloud items={allItems} />
    </aside>
  )
}

export function CommunityHome() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [transforming, setTransforming] = useState(null)
  const feed = useAsync(() => studentApi.get('/community/feed'), [])
  const groupList = useAsync(() => (FEATURES.studyGroups ? studentApi.get('/community/groups') : Promise.resolve({ groups: [] })), [])
  const myGroups = (groupList.data?.groups || []).filter((g) => g.joined)
  useDocumentTitle(t('community.title'))
  const data = feed.data
  const tab = TAB_VALUES.includes(params.get('tipo')) ? params.get('tipo') : 'all'
  const category = params.get('categoria') || ''
  const sort = params.get('ordem') === 'alta' ? 'alta' : 'recentes'

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all' || value === 'recentes') next.delete(key)
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
    count: value === 'all' ? TAB_VALUES.filter((k) => k !== 'all' && k !== 'mine').reduce((s, k) => s + (counts[k] || 0), 0) : counts[value]
  }))
  const tabs = FEATURES.materials
    ? [
        ...kindTabs,
        {
          value: 'mine',
          label: t('community.mine.title'),
          icon: 'user',
          count: counts.mine
        }
      ]
    : kindTabs

  const allItems = useMemo(() => {
    if (!data) return []
    const decks = data.highlights.map((d) => ({ kind: 'flashcards', ...d }))
    const materials = Object.values(data.materials || {}).flat()
    return [...decks, ...materials]
  }, [data])
  const pulse = useMemo(() => pulseOf(allItems), [allItems])

  const items = useMemo(() => {
    if (!data || tab === 'mine') return []
    const list = allItems.filter((i) => tab === 'all' || i.kind === tab).filter((i) => !category || i.categoryId === category)
    return sort === 'alta' ? list.sort((a, b) => engagement(b) - engagement(a)) : list.sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
  }, [data, allItems, tab, category, sort])

  const heading = tab === 'all' ? t('community.timeline.title') : t(`community.kindsPlural.${tab}`)

  return (
    <div className={home.page}>
      <header className={home.head}>
        <div className={home.headText}>
          <span className={home.eyebrow}>{t('community.eyebrow')}</span>
          <h1 className={home.title}>{t('community.title')}</h1>
          <p className={home.lead}>{t('community.subtitle')}</p>
        </div>
        <div className={home.headRight}>
          <div className={home.search}>
            <SearchField
              value={q}
              onChange={(v) => {
                setQ(v)
                if (v.trim().length >= 3) goSearch(v, true)
              }}
              onSubmit={goSearch}
            />
          </div>
          {FEATURES.materials ? (
            <Button icon="edit" to="/app/perfil/blog/novo">
              {t('community.blog.write')}
            </Button>
          ) : null}
        </div>
      </header>

      {data ? <PulseBar pulse={pulse} /> : null}

      <div className={home.toolbar}>
        <FilterTabs tabs={tabs} value={tab} onChange={(v) => setParam('tipo', v)} />
        {tab !== 'mine' ? (
          <div className={home.tools}>
            {data?.categories ? (
              <label className={home.select}>
                <span className="sr-only">{t('community.filters.category')}</span>
                <Icon name="filter" size={16} />
                <select value={category} onChange={(e) => setParam('categoria', e.target.value)}>
                  <option value="">{t('community.feed.allCategories')}</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={14} />
              </label>
            ) : null}
            <Segmented
              label={t('community.feed.sortLabel')}
              value={sort}
              onChange={(v) => setParam('ordem', v)}
              options={[
                {
                  value: 'recentes',
                  label: t('community.feed.recent'),
                  icon: 'clock'
                },
                {
                  value: 'alta',
                  label: t('community.feed.hot'),
                  icon: 'flame'
                }
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className={home.layout}>
        <div role="tabpanel" id="comunidade-panel" aria-labelledby={`comunidade-tab-${tab}`} tabIndex={-1} className={home.main}>
          {tab === 'mine' ? (
            <MyContents onChanged={() => feed.run().catch(() => {})} />
          ) : (
            <>
              {feed.loading && !data ? <Skeleton height={180} count={3} /> : null}
              {feed.error && !data ? (
                <Banner
                  tone="danger"
                  icon="alert"
                  action={
                    <Button size="small" variant="soft" onClick={() => feed.run()}>
                      {t('common.actions.retry')}
                    </Button>
                  }
                >
                  {t('common.state.error')}
                </Banner>
              ) : null}
              {data && tab === 'all' && !category ? <Spotlight items={allItems} onTransform={FEATURES.mcp ? setTransforming : null} /> : null}
              {data ? <ShareBox /> : null}
              {data && tab === 'noticia' ? <BlogList posts={items} /> : null}
              {data && tab !== 'noticia' ? (
                <section className={home.feedSection} aria-labelledby="feed-title">
                  <div className={home.feedHead}>
                    <h2 id="feed-title" className={home.feedTitle}>
                      {sort === 'alta' ? t('community.feed.hotTitle') : heading}
                    </h2>
                    <span className={home.feedCount}>{t('community.timeline.count', { count: items.length })}</span>
                  </div>
                  <Timeline
                    items={items}
                    grouped={sort !== 'alta'}
                    onTransform={FEATURES.mcp ? setTransforming : null}
                    emptyText={
                      category
                        ? t('community.categoryEmpty')
                        : t('community.kindEmpty', {
                            kind: heading.toLowerCase()
                          })
                    }
                  />
                </section>
              ) : null}
            </>
          )}
        </div>
        {data ? <SideRail data={data} allItems={allItems} groups={myGroups} /> : null}
      </div>
      {FEATURES.mcp ? <TransformSheet open={Boolean(transforming)} item={transforming} onClose={() => setTransforming(null)} /> : null}
    </div>
  )
}
