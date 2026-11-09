import { communityDeckPublic } from './helpers.js'
import { materialPublic, publishedMaterials } from './materials.js'

const lower = (list = []) => list.map((x) => String(x).toLowerCase())

export function groupMatches(group, item) {
  if (group.categoryIds.includes(item.categoryId)) return true
  const tags = lower(group.tags)
  return lower(item.tags).some((t) => tags.includes(t))
}

export function groupItems(state, group, viewerId) {
  const decks = state.community.decks.map((d) => ({ kind: 'flashcards', ...communityDeckPublic(state, d, viewerId) }))
  const materials = publishedMaterials(state, viewerId).map((m) => materialPublic(state, m, viewerId))
  return [...decks, ...materials].filter((item) => groupMatches(group, item))
}

export function groupSummary(state, group, viewerId) {
  const members = state.community.groupMembers.filter((m) => m.groupId === group.id)
  const joined = members.some((m) => m.userId === viewerId)
  const items = groupItems(state, group, viewerId)
  const authors = new Map()
  items.forEach((i) => i.author && authors.set(i.author.id, i.author.name))
  const posts = state.community.groupPosts.filter((p) => p.groupId === group.id)
  return {
    id: group.id,
    name: group.name,
    tagline: group.tagline,
    description: group.description,
    examName: group.examName,
    examDate: group.examDate,
    color: group.color,
    memberCount: group.baseMembers + members.length,
    joined,
    itemCount: items.length,
    creatorCount: authors.size,
    postCount: posts.length,
    lastActivityAt:
      posts
        .map((p) => p.createdAt)
        .sort()
        .pop() || null,
    weekly: { goal: group.weeklyGoal, done: group.weeklyDone },
    faces: [...authors.values()].slice(0, 4)
  }
}

export function groupRanking(items) {
  const score = new Map()
  items.forEach((i) => {
    if (!i.author) return
    const points = i.kind === 'flashcards' ? i.stats.studiedWeek + i.stats.votes * 2 : Math.round(i.stats.views / 2) + i.stats.favorites * 2
    const cur = score.get(i.author.id) || { authorId: i.author.id, name: i.author.name, handle: i.author.handle, points: 0, items: 0 }
    cur.points += points
    cur.items += 1
    score.set(i.author.id, cur)
  })
  return [...score.values()].sort((a, b) => b.points - a.points).map((r, idx) => ({ position: idx + 1, ...r }))
}
