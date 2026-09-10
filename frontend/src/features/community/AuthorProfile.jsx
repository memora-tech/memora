import { useState } from 'react'
import { useParams } from 'react-router-dom'
import styles from './community.module.css'
import { Avatar, Badge, Banner, Button, Chip, NeuronCounter, PageHeader, Skeleton, Stat, Surface, useToast } from '../../design-system/index.js'
import { useT } from '../../i18n/index.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { studentApi } from '../../lib/api.js'
import { fmtNumber } from '../../lib/format.js'
import { CommunityDeckCard } from './CommunityDeckCard.jsx'

export function AuthorProfile() {
  const t = useT()
  const toast = useToast()
  const { authorId } = useParams()
  const [allBadges, setAllBadges] = useState(false)
  const profile = useAsync(() => studentApi.get(`/community/authors/${authorId}`), [authorId])
  const data = profile.data
  const author = data?.author
  useDocumentTitle(author?.name)

  const follow = async () => {
    try {
      await studentApi.post(`/community/authors/${authorId}/follow`)
      profile.run()
    } catch (err) {
      if (err.code === 'guardian_required') toast.show({ message: `${t('common.guardian.required')} ${t('common.guardian.requestSent')}`, icon: 'shield', duration: 6000 })
      else toast.show({ message: err.message, tone: 'danger' })
    }
  }

  if (profile.loading && !data) return <Skeleton height={140} count={2} />
  if (profile.error && !data) return <Banner tone="danger" icon="alert">{t('community.author.notFound')}</Banner>
  if (!author) return null

  const badges = allBadges ? author.badges : author.badges.slice(0, 3)

  return (
    <div className={styles.page}>
      <PageHeader title={author.name}>{author.bio || null}</PageHeader>
      <Surface>
        <div className={styles.profileHead}>
          <Avatar name={author.name} large />
          <div className={styles.creatorBody}>
            <span className={styles.authorName}>@{author.handle}</span>
            <span className={styles.meta}>{t('community.author.level', { level: author.level, topic: author.topic })}</span>
          </div>
          <div className={styles.profileFollow}>
            <Button block variant={author.following ? 'soft' : 'primary'} icon={author.following ? 'check' : 'plus'} aria-pressed={author.following ? 'true' : 'false'} onClick={follow}>
              {author.following ? t('community.deck.followingAuthor') : t('community.deck.follow')}
            </Button>
          </div>
        </div>
        <div className={styles.stats} style={{ marginTop: 16 }}>
          <Stat value={fmtNumber(author.points)} label={t('community.author.labels.points')} />
          <Stat value={fmtNumber(author.followers)} label={t('community.author.labels.followers')} />
          <Stat value={fmtNumber(author.decksCount)} label={t('community.author.labels.decks')} />
        </div>
        <div className={styles.authorNeurons}>
          <NeuronCounter value={author.neuronsTotal} showLabel />
          <span className={styles.meta}>{t('community.author.neuronsHint')}</span>
        </div>
      </Surface>

      {author.badges.length ? (
        <Surface tone="sunken">
          <div className={styles.sectionTitle} style={{ marginBottom: 8 }}>
            <span>{t('community.author.badges')}</span>
            {author.badges.length > 0 ? <Badge tone="success" icon="shield">{t('community.author.approved')}</Badge> : null}
          </div>
          <div className={styles.badges}>
            {badges.map((b) => (
              <Chip key={b} tone="reward" icon="trophy">
                {b}
              </Chip>
            ))}
          </div>
          {author.badges.length > 3 ? (
            <Button size="small" variant="text" onClick={() => setAllBadges((v) => !v)} style={{ marginTop: 8 }}>
              {allBadges ? t('community.author.lessBadges') : t('community.author.moreBadges', { count: author.badges.length - 3 })}
            </Button>
          ) : null}
          <p className={styles.meta} style={{ marginTop: 8 }}>
            {t('community.author.badgeNote')}
          </p>
        </Surface>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('community.author.decks')}</h2>
        <div className={styles.grid}>
          {data.decks.map((d) => (
            <CommunityDeckCard key={d.id} deck={d} />
          ))}
        </div>
      </section>
    </div>
  )
}
