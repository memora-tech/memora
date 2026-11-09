import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './groups.module.css'
import { Avatar, Banner, Breadcrumbs, Button, EmptyState, Icon, Skeleton, TabBar, TabPanel, TargetRing, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { daysUntil, fmtNumber, fmtRelative, pct } from '../../lib/format.js'
import { Timeline } from './Timeline.jsx'
import { TransformSheet } from '../noa/AiFormats.jsx'
import { useSession } from '../../state/SessionContext.jsx'

function Countdown({ group }) {
  const t = useT()
  if (!group.examDate) return null
  const days = daysUntil(group.examDate)
  if (days === null || days < 0) return null
  return (
    <span className={styles.countdown}>
      <Icon name="calendar" size={14} />
      {days === 0 ? t('community.groups.examToday', { exam: group.examName }) : t('community.groups.examIn', { exam: group.examName, count: days })}
    </span>
  )
}

function Faces({ names }) {
  return (
    <span className={styles.faces} aria-hidden="true">
      {names.map((n) => (
        <Avatar key={n} name={n} />
      ))}
    </span>
  )
}

export function GroupCard({ group, onToggle, busy }) {
  const t = useT()
  const progress = pct(group.weekly.done, group.weekly.goal)
  return (
    <article className={styles.card} data-color={group.color}>
      <div className={styles.cover}>
        <span className={styles.coverPattern} aria-hidden="true" />
        <Countdown group={group} />
        {group.joined ? (
          <span className={styles.memberTag}>
            <Icon name="check" size={12} /> {t('community.groups.member')}
          </span>
        ) : null}
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          <Link to={`/app/comunidade/grupos/${group.id}`} className={styles.cardLink}>
            {group.name}
          </Link>
        </h3>
        <p className={styles.tagline}>{group.tagline}</p>
        <dl className={styles.cardStats}>
          <div>
            <dt>{t('community.groups.members')}</dt>
            <dd className="tabnum">{fmtNumber(group.memberCount)}</dd>
          </div>
          <div>
            <dt>{t('community.groups.materials')}</dt>
            <dd className="tabnum">{group.itemCount}</dd>
          </div>
          <div>
            <dt>{t('community.groups.creators')}</dt>
            <dd className="tabnum">{group.creatorCount}</dd>
          </div>
        </dl>
        <div className={styles.goal}>
          <span className={styles.goalHead}>
            <span>{t('community.groups.weeklyGoal')}</span>
            <span className="tabnum">{progress}%</span>
          </span>
          <span className={styles.goalTrack} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('community.groups.weeklyGoal')}>
            <span className={styles.goalFill} style={{ width: `${progress}%` }} />
          </span>
        </div>
        <div className={styles.cardFoot}>
          <Faces names={group.faces} />
          {onToggle ? (
            <Button size="small" variant={group.joined ? 'ghost' : 'primary'} icon={group.joined ? undefined : 'plus'} loading={busy} onClick={() => onToggle(group)} aria-label={`${group.joined ? t('community.groups.leave') : t('community.groups.join')} ${group.name}`}>
              {group.joined ? t('community.groups.leave') : t('community.groups.join')}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function useGroupToggle(onDone) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const toggle = async (group) => {
    setBusy(group.id)
    try {
      const res = await studentApi.post(`/community/groups/${group.id}/join`)
      toast.show({ message: res.group.joined ? t('community.groups.joined', { name: group.name }) : t('community.groups.left', { name: group.name }), icon: res.group.joined ? 'check' : 'x' })
      onDone?.()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }
  return { toggle, busy }
}

export function GroupsPage() {
  const t = useT()
  useDocumentTitle(t('community.groups.title'))
  const list = useAsync(() => studentApi.get('/community/groups'), [])
  const refresh = () => list.run().catch(() => {})
  const { toggle, busy } = useGroupToggle(refresh)
  const groups = list.data?.groups || []
  const mine = groups.filter((g) => g.joined)
  const others = groups.filter((g) => !g.joined)
  const totalMembers = groups.reduce((s, g) => s + g.memberCount, 0)

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <Breadcrumbs items={[{ label: t('community.title'), to: '/app/comunidade' }, { label: t('community.groups.title') }]} />
        <div className={styles.pageHeadRow}>
          <div className={styles.pageHeadText}>
            <span className={styles.eyebrow}>{t('community.groups.eyebrow')}</span>
            <h1 className={styles.pageTitle}>{t('community.groups.title')}</h1>
            <p className={styles.pageLead}>{t('community.groups.lead')}</p>
          </div>
          {groups.length ? (
            <div className={styles.headStat}>
              <span className={styles.headStatValue}>{fmtNumber(totalMembers)}</span>
              <span className={styles.headStatLabel}>{t('community.groups.totalMembers', { count: groups.length })}</span>
            </div>
          ) : null}
        </div>
      </header>

      {list.loading && !list.data ? <Skeleton height={220} count={2} /> : null}
      {list.error && !list.data ? (
        <Banner
          tone="danger"
          icon="alert"
          action={
            <Button size="small" variant="soft" onClick={refresh}>
              {t('common.actions.retry')}
            </Button>
          }
        >
          {t('common.state.error')}
        </Banner>
      ) : null}

      {mine.length ? (
        <section className={styles.section} aria-labelledby="g-mine">
          <h2 id="g-mine" className={styles.sectionTitle}>
            {t('community.groups.mine')} <span className={styles.count}>{mine.length}</span>
          </h2>
          <div className={styles.grid}>
            {mine.map((g) => (
              <GroupCard key={g.id} group={g} onToggle={toggle} busy={busy === g.id} />
            ))}
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section className={styles.section} aria-labelledby="g-discover">
          <h2 id="g-discover" className={styles.sectionTitle}>
            {t('community.groups.discover')} <span className={styles.count}>{others.length}</span>
          </h2>
          <div className={styles.grid}>
            {others.map((g) => (
              <GroupCard key={g.id} group={g} onToggle={toggle} busy={busy === g.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Mural({ group, posts, onChanged }) {
  const t = useT()
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [likes, setLikes] = useState({})
  const session = useSession()

  const send = async (e) => {
    e.preventDefault()
    if (text.trim().length < 3) return
    setSending(true)
    try {
      await studentApi.post(`/community/groups/${group.id}/posts`, { text: text.trim() })
      setText('')
      toast.show({ message: t('community.groups.posted'), icon: 'check' })
      onChanged()
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    } finally {
      setSending(false)
    }
  }

  const like = async (post) => {
    try {
      const res = await studentApi.post(`/community/group-posts/${post.id}/like`)
      setLikes((prev) => ({ ...prev, [post.id]: res }))
    } catch (err) {
      toast.show({ message: err.message, tone: 'danger' })
    }
  }

  return (
    <div className={styles.mural}>
      {group.joined ? (
        <form className={styles.composer} onSubmit={send}>
          <Avatar name={session.user?.name} />
          <label className="sr-only" htmlFor="mural-text">
            {t('community.groups.composerLabel')}
          </label>
          <textarea id="mural-text" className={styles.composerInput} rows={2} maxLength={600} placeholder={t('community.groups.composerPlaceholder', { name: group.name })} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="small" icon="send" loading={sending} disabled={text.trim().length < 3}>
            {t('community.groups.post')}
          </Button>
        </form>
      ) : (
        <Banner tone="neutral" icon="users">
          {t('community.groups.joinToPost')}
        </Banner>
      )}
      {posts.length ? (
        <ol className={styles.posts}>
          {posts.map((p) => {
            const state = likes[p.id] || { likes: p.likes, liked: p.liked }
            return (
              <li key={p.id} className={styles.post} data-mine={p.isMine ? 'true' : 'false'}>
                <Avatar name={p.authorName} />
                <div className={styles.postBody}>
                  <span className={styles.postHead}>
                    <span className={styles.postAuthor}>{p.authorName}</span>
                    <time className={styles.postTime} dateTime={p.createdAt}>
                      {fmtRelative(p.createdAt)}
                    </time>
                  </span>
                  <p className={styles.postText}>{p.text}</p>
                  <button type="button" className={styles.like} aria-pressed={state.liked ? 'true' : 'false'} onClick={() => like(p)} aria-label={t('community.groups.like', { count: state.likes })}>
                    <Icon name="heart" size={14} />
                    <span className="tabnum">{fmtNumber(state.likes)}</span>
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState icon="message" title={t('community.groups.emptyMural')} text={t('community.groups.emptyMuralText')} />
      )}
    </div>
  )
}

function Ranking({ ranking }) {
  const t = useT()
  if (!ranking.length) return <p className={styles.muted}>{t('community.groups.emptyRanking')}</p>
  const podium = ranking.slice(0, 3)
  const order = [podium[1], podium[0], podium[2]].filter(Boolean)
  return (
    <div className={styles.rankingWrap}>
      <ol className={styles.podium} aria-label={t('community.groups.podium')}>
        {order.map((r) => (
          <li key={r.authorId} className={styles.podiumItem} data-pos={r.position}>
            <Avatar name={r.name} large />
            <span className={styles.podiumName}>{r.name}</span>
            <span className={styles.muted}>{t('community.groups.points', { value: fmtNumber(r.points) })}</span>
            <span className={styles.podiumBlock}>
              <span className="sr-only">{t('community.groups.position', { n: r.position })}</span>
              <span aria-hidden="true">{r.position}</span>
            </span>
          </li>
        ))}
      </ol>
      {ranking.length > 3 ? (
        <ol className={styles.rankList} start={4}>
          {ranking.slice(3).map((r) => (
            <li key={r.authorId} className={styles.rankRow}>
              <span className={styles.rankPos}>{r.position}</span>
              <Avatar name={r.name} />
              <span className={styles.rankName}>{r.name}</span>
              <span className={styles.muted}>{t('community.groups.itemsCount', { count: r.items })}</span>
              <span className={`${styles.rankPoints} tabnum`}>{fmtNumber(r.points)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className={styles.muted}>{t('community.groups.rankingRule')}</p>
    </div>
  )
}

export function GroupDetail() {
  const t = useT()
  const { groupId } = useParams()
  const detail = useAsync(() => studentApi.get(`/community/groups/${groupId}`), [groupId])
  const data = detail.data
  const group = data?.group
  useDocumentTitle(group ? group.name : t('community.groups.title'))
  const refresh = () => detail.run().catch(() => {})
  const { toggle, busy } = useGroupToggle(refresh)
  const [tab, setTab] = useState('mural')
  const [transforming, setTransforming] = useState(null)

  if (detail.loading && !data) return <Skeleton height={240} count={2} />
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
        {detail.error.status === 404 ? t('community.groups.notFound') : t('common.state.error')}
      </Banner>
    )
  }
  if (!group) return null
  const progress = pct(group.weekly.done, group.weekly.goal)

  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: t('community.title'), to: '/app/comunidade' }, { label: t('community.groups.title'), to: '/app/comunidade/grupos' }, { label: group.name }]} />
      <header className={styles.hero} data-color={group.color}>
        <span className={styles.coverPattern} aria-hidden="true" />
        <div className={styles.heroMain}>
          <span className={styles.heroEyebrow}>{t('community.groups.eyebrow')}</span>
          <h1 className={styles.heroTitle}>{group.name}</h1>
          <p className={styles.heroLead}>{group.tagline}</p>
          <div className={styles.heroMeta}>
            <span>
              <Icon name="users" size={16} /> {t('community.groups.membersCount', { value: fmtNumber(group.memberCount) })}
            </span>
            <span>
              <Icon name="layers" size={16} /> {t('community.groups.materialsCount', { count: group.itemCount })}
            </span>
            <Countdown group={group} />
          </div>
        </div>
        <div className={styles.heroSide}>
          <Faces names={group.faces} />
          <Button variant={group.joined ? 'ghost' : 'reward'} className={styles.heroBtn} icon={group.joined ? 'check' : 'plus'} loading={busy === group.id} onClick={() => toggle(group)}>
            {group.joined ? t('community.groups.memberLeave') : t('community.groups.join')}
          </Button>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <TabBar
            idBase="grupo"
            label={t('community.groups.tabsLabel')}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'mural', label: t('community.groups.tabs.mural'), icon: 'message', count: data.posts.length },
              { value: 'materiais', label: t('community.groups.tabs.materials'), icon: 'layers', count: data.items.length },
              { value: 'ranking', label: t('community.groups.tabs.ranking'), icon: 'trophy' }
            ]}
          />
          <TabPanel idBase="grupo" value={tab}>
            {tab === 'mural' ? <Mural group={group} posts={data.posts} onChanged={refresh} /> : null}
            {tab === 'materiais' ? <Timeline items={data.items} onTransform={setTransforming} emptyText={t('community.groups.emptyMaterials')} /> : null}
            {tab === 'ranking' ? <Ranking ranking={data.ranking} /> : null}
          </TabPanel>
        </div>
        <aside className={styles.detailRail} aria-label={t('community.groups.about')}>
          <section className={styles.railCard} aria-labelledby="g-goal">
            <h2 id="g-goal" className={styles.railTitle}>
              {t('community.groups.weeklyGoal')}
            </h2>
            <div className={styles.goalRing}>
              <TargetRing value={group.weekly.done} max={group.weekly.goal} size={120} center={`${progress}%`} />
              <p className={styles.muted}>{t('community.groups.goalText', { done: fmtNumber(group.weekly.done), goal: fmtNumber(group.weekly.goal) })}</p>
            </div>
          </section>
          <section className={styles.railCard} aria-labelledby="g-about">
            <h2 id="g-about" className={styles.railTitle}>
              {t('community.groups.about')}
            </h2>
            <p className={styles.muted}>{group.description}</p>
            <ul className={styles.tags}>
              {group.tags.map((tag) => (
                <li key={tag}>
                  <Link to={`/app/comunidade/busca?q=${encodeURIComponent(tag)}`} className={styles.tag}>
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.railCard} aria-labelledby="g-rules">
            <h2 id="g-rules" className={styles.railTitle}>
              <Icon name="shield" size={14} /> {t('community.groups.rules')}
            </h2>
            <ol className={styles.rules}>
              {group.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      <TransformSheet open={Boolean(transforming)} item={transforming} onClose={() => setTransforming(null)} />
    </div>
  )
}
