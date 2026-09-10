import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Badge, Banner, Button, Icon, Input, Skeleton, Surface } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber, fmtTime } from '../../lib/format.js'
import { CommunityDeckCard } from './CommunityDeckCard.jsx'

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

export function CommunityHome() {
  const t = useT()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [allHighlights, setAllHighlights] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const feed = useAsync(() => studentApi.get('/community/feed'), [])
  useDocumentTitle(t('community.title'))
  const data = feed.data

  const goSearch = (value, keepFocus = false) => {
    if (value.trim().length >= 3) navigate(`/app/comunidade/busca?q=${encodeURIComponent(value.trim())}${keepFocus ? '&focus=1' : ''}`)
  }

  const recommended = (data?.recommendations || []).slice(0, 2)
  const shown = new Set(recommended.map((d) => d.id))
  const highlights = (data?.highlights || []).filter((d) => !shown.has(d.id))

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('community.title')}</h1>
      <SearchField
        value={q}
        onChange={(v) => {
          setQ(v)
          if (v.trim().length >= 3) goSearch(v, true)
        }}
        onSubmit={goSearch}
      />

      {feed.loading && !data ? <Skeleton height={120} count={3} /> : null}
      {feed.error && !data ? (
        <Banner tone="danger" icon="alert" action={<Button size="small" variant="soft" onClick={() => feed.run()}>{t('common.actions.retry')}</Button>}>
          {t('common.state.error')}
        </Banner>
      ) : null}

      {data ? (
        <>
          {data.creatorOfMonth ? (
            <Surface tone="brand" className={styles.creator}>
              <Avatar name={data.creatorOfMonth.name} large />
              <div className={styles.creatorBody}>
                <Badge tone="reward" icon="trophy">
                  {t('community.creatorOfMonth')}
                </Badge>
                <Link to={`/app/comunidade/autor/${data.creatorOfMonth.id}`} className={styles.creatorLink}>
                  {data.creatorOfMonth.name}
                </Link>
                <span className={styles.meta}>
                  {t('community.author.level', { level: data.creatorOfMonth.level, topic: data.creatorOfMonth.topic })} · {t('community.deck.followers', { count: data.creatorOfMonth.followers })}
                </span>
              </div>
            </Surface>
          ) : null}

          {recommended.length ? (
            <section className={styles.section} aria-labelledby="sec-noa">
              <h2 id="sec-noa" className={styles.sectionTitle}>
                <span>
                  <Badge tone="noa">{t('study.session.noaLabel')}</Badge> {t('community.recommended')}
                </span>
              </h2>
              <div className={styles.grid}>
                {recommended.map((d) => (
                  <CommunityDeckCard key={d.id} deck={d} because={t('community.recommendedBecause', { deck: d.becauseDeck })} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.section} aria-labelledby="sec-destaques">
            <h2 id="sec-destaques" className={styles.sectionTitle}>
              {t('community.highlights')}
            </h2>
            <div className={styles.grid}>
              {highlights.slice(0, allHighlights ? 6 : 3).map((d) => (
                <CommunityDeckCard key={d.id} deck={d} />
              ))}
            </div>
            {highlights.length > 3 ? (
              <div className={styles.sectionFooter}>
                <Button variant="ghost" size="small" iconRight={allHighlights ? 'chevronUp' : 'chevronDown'} onClick={() => setAllHighlights((v) => !v)}>
                  {allHighlights ? t('community.seeLess') : t('community.seeMore')}
                </Button>
              </div>
            ) : null}
          </section>

          <section className={styles.section} aria-labelledby="sec-ranking">
            <h2 id="sec-ranking" className={styles.sectionTitle}>
              {t('community.rankingWeek')}
            </h2>
            <Surface className={styles.ranking}>
              {data.rankingWeek.slice(0, 5).map((r) => (
                <Link key={r.deckId} to={`/app/comunidade/deck/${r.deckId}`} className={styles.rankRow}>
                  <span className={styles.rankPos} data-top={r.position === 1 ? 'true' : 'false'}>
                    {r.position}
                  </span>
                  <span className={styles.rankBody}>
                    <span className={styles.rankName}>{r.name}</span>
                    <span className={styles.rankMeta}>
                      {t('community.deck.byAuthor')} {r.authorName}
                    </span>
                  </span>
                  <span className={styles.rankCount}>{t('community.studiedWeek', { count: r.studiedWeek, value: fmtNumber(r.studiedWeek) })}</span>
                </Link>
              ))}
            </Surface>
            <p className={styles.meta}>{t('community.materialized', { time: fmtTime(data.materializedAt) })}</p>
            <Button variant="text" size="small" iconRight={rulesOpen ? 'chevronUp' : 'chevronDown'} onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen ? 'true' : 'false'}>
              {t('community.rankingRulesToggle')}
            </Button>
            {rulesOpen ? <p className={styles.meta}>{t('community.rankingRules')}</p> : null}
          </section>

          <section className={styles.section} aria-labelledby="sec-seguindo">
            <h2 id="sec-seguindo" className={styles.sectionTitle}>
              {t('community.following')}
            </h2>
            {data.following.length ? (
              <div className={styles.grid}>
                {data.following.slice(0, 3).map((d) => (
                  <CommunityDeckCard key={d.id} deck={d} />
                ))}
              </div>
            ) : (
              <p className={styles.meta}>{t('community.followingEmpty')}</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
