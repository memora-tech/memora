import { id, nowIso } from '../lib/ids.js'
import { CATEGORIES } from '../seed/content.js'
import { DEFAULT_PUBLIC_PROFILE, mapDeckRow } from './mappers.js'
import { createServiceClient } from './supabase.js'

export const ALLOWED_REACTIONS = ['👏', '🔥', '🧠', '💡', '❤️', '😂']
export const CONTENT_POLICY_VERSION = 'v2.1'
export const CONTENT_POLICY_SUMMARY = [
  'Sem plágio ou material com direitos autorais de terceiros.',
  'Sem dados pessoais de terceiros (CPF, e-mail, telefone).',
  'Sem conteúdo impróprio para menores, discurso de ódio ou desinformação.'
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]))

function defaultReactions(raw = {}) {
  return {
    '👏': 0,
    '🔥': 0,
    '🧠': 0,
    '💡': 0,
    '❤️': 0,
    '😂': 0,
    ...(raw || {})
  }
}

function defaultStats(raw = {}) {
  return {
    studiedWeek: Number(raw?.studiedWeek ?? 0),
    votes: Number(raw?.votes ?? 0),
    favorites: Number(raw?.favorites ?? 0),
    comments: Number(raw?.comments ?? 0),
    clones: Number(raw?.clones ?? 0)
  }
}

export function createCommunityRepo({ serviceClient = null } = {}) {
  function getService(fallbackDb = null) {
    return serviceClient || createServiceClient() || fallbackDb
  }

  async function loadCommunityContext(db, user, pubRows = []) {
    const pubIds = pubRows.map((p) => p.id)
    const authorIds = [...new Set(pubRows.map((p) => p.author_id).filter(Boolean))]
    const svc = getService(db)

    const [
      { data: commentRows, error: cmErr },
      { data: likeRows, error: lkErr },
      { data: favRows, error: favErr },
      { data: voteRows, error: vtErr },
      { data: reactRows, error: rcErr },
      { data: followRows, error: flErr },
      { data: studyRow, error: stErr },
      { data: ownDeckRows, error: dkErr },
      { data: authorRows }
    ] = await Promise.all([
      pubIds.length
        ? db.from('deck_comments').select('*').is('hidden_at', null).order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      pubIds.length
        ? db.from('comment_likes').select('*')
        : Promise.resolve({ data: [], error: null }),
      user
        ? db.from('deck_favorites').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [], error: null }),
      pubIds.length
        ? db.from('deck_votes').select('*')
        : Promise.resolve({ data: [], error: null }),
      pubIds.length
        ? db.from('deck_reactions').select('*')
        : Promise.resolve({ data: [], error: null }),
      db.from('author_follows').select('*'),
      user
        ? db.from('study_settings').select('*').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      user
        ? db.from('decks').select('*').eq('owner_id', user.id).is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
      authorIds.length && svc
        ? svc.from('profiles').select('id, name, public_profile').in('id', authorIds)
        : Promise.resolve({ data: [], error: null })
    ])

    if (cmErr) throw cmErr
    if (lkErr) throw lkErr
    if (favErr) throw favErr
    if (vtErr) throw vtErr
    if (rcErr) throw rcErr
    if (flErr) throw flErr
    if (stErr) throw stErr
    if (dkErr) throw dkErr

    const pubIdSet = new Set(pubIds)
    const commentsByPub = {}
    for (const c of commentRows || []) {
      const pId = c.publication_id ?? c.publicationId
      if (!pubIdSet.has(pId)) continue
      if (!commentsByPub[pId]) commentsByPub[pId] = []
      commentsByPub[pId].push(c)
    }

    const likesByComment = {}
    for (const l of likeRows || []) {
      const cId = l.comment_id ?? l.commentId
      if (!likesByComment[cId]) likesByComment[cId] = []
      likesByComment[cId].push(l.user_id ?? l.userId)
    }

    const favoritedSet = new Set(
      (favRows || []).map((f) => f.publication_id ?? f.publicationId)
    )

    const votesByPub = {}
    const myVotedSet = new Set()
    for (const v of voteRows || []) {
      const pId = v.publication_id ?? v.publicationId
      const uId = v.user_id ?? v.userId
      votesByPub[pId] = (votesByPub[pId] || 0) + Number(v.weight ?? 1)
      if (user && uId === user.id) myVotedSet.add(pId)
    }

    const reactionsByPub = {}
    const myReactionsByPub = {}
    for (const r of reactRows || []) {
      const pId = r.publication_id ?? r.publicationId
      const uId = r.user_id ?? r.userId
      const emoji = r.emoji
      if (!reactionsByPub[pId]) reactionsByPub[pId] = defaultReactions()
      if (reactionsByPub[pId][emoji] !== undefined) {
        reactionsByPub[pId][emoji] += 1
      }
      if (user && uId === user.id) {
        if (!myReactionsByPub[pId]) myReactionsByPub[pId] = []
        myReactionsByPub[pId].push(emoji)
      }
    }

    const followedAuthors = new Set()
    const followersCountByAuthor = {}
    for (const f of followRows || []) {
      const followerId = f.follower_id ?? f.followerId
      const authorId = f.author_id ?? f.authorId
      followersCountByAuthor[authorId] = (followersCountByAuthor[authorId] || 0) + 1
      if (user && followerId === user.id) followedAuthors.add(authorId)
    }

    const clonedPubMap = new Map()
    for (const d of ownDeckRows || []) {
      const cf = d.cloned_from ?? d.clonedFrom
      if (cf?.deckId) clonedPubMap.set(cf.deckId, cf)
    }

    const authorProfileById = {}
    for (const a of authorRows || []) {
      authorProfileById[a.id] = {
        name: a.name,
        publicProfile: {
          ...DEFAULT_PUBLIC_PROFILE,
          ...(a.public_profile || a.publicProfile || {})
        }
      }
    }

    return {
      commentsByPub,
      likesByComment,
      favoritedSet,
      votesByPub,
      myVotedSet,
      reactionsByPub,
      myReactionsByPub,
      followedAuthors,
      followersCountByAuthor,
      communityAnswered: studyRow?.community_answered || studyRow?.communityAnswered || {},
      ownDecks: ownDeckRows || [],
      clonedPubMap,
      authorProfileById
    }
  }

  function mapPublicationWithContext(pub, ctx, user) {
    const snapshot = Array.isArray(pub.snapshot) ? pub.snapshot : []
    const total = Number(pub.card_count ?? pub.cardCount ?? snapshot.length)
    const answered = Number(ctx.communityAnswered?.[pub.id] ?? 0)
    const canVote = answered >= 20 || (total > 0 && answered / total >= 0.3)
    const pubComments = ctx.commentsByPub[pub.id] || []
    const rootComments = pubComments.filter((c) => !(c.parent_id ?? c.parentId)).slice(-2)
    const baseStats = defaultStats(pub.stats)
    const liveVotes = ctx.votesByPub[pub.id]
    const stats = {
      ...baseStats,
      votes: typeof liveVotes === 'number' ? Math.max(baseStats.votes, liveVotes) : baseStats.votes,
      comments: pubComments.length
    }
    const storedReactions = defaultReactions(pub.reactions)
    const liveReactions = ctx.reactionsByPub[pub.id]
    const reactions = liveReactions
      ? Object.fromEntries(
          ALLOWED_REACTIONS.map((e) => [
            e,
            Math.max(Number(storedReactions[e] ?? 0), Number(liveReactions[e] ?? 0))
          ])
        )
      : storedReactions

    const authorId = pub.author_id ?? pub.authorId
    const authorEntry = ctx.authorProfileById[authorId]
    const authorPublic = authorEntry?.publicProfile || DEFAULT_PUBLIC_PROFILE
    const categoryId = pub.category_id ?? pub.categoryId ?? 'outros'

    return {
      id: pub.id,
      deckId: pub.deck_id ?? pub.deckId,
      publicId: pub.public_id ?? pub.publicId,
      authorId,
      name: pub.name,
      description: pub.description || '',
      categoryId,
      categoryName: CATEGORY_MAP[categoryId] || 'Outros',
      difficulty: pub.difficulty || 'medio',
      lang: pub.lang || 'pt-BR',
      tags: Array.isArray(pub.tags) ? pub.tags : [],
      version: Number(pub.version ?? 1),
      cardCount: total,
      publishedAt: pub.published_at ?? pub.publishedAt ?? pub.created_at,
      updatedAt: pub.updated_at ?? pub.updatedAt ?? pub.published_at ?? pub.created_at,
      approved: (pub.status || 'aprovado') === 'aprovado',
      stats,
      reactions,
      kind: 'flashcards',
      author: {
        id: authorId,
        name: pub.author_name ?? pub.authorName ?? authorEntry?.name ?? 'Autor',
        level: Number(authorPublic.level ?? 1),
        topic: authorPublic.topic || CATEGORY_MAP[categoryId] || 'Geral',
        points: Number(authorPublic.points ?? 0),
        badges: Array.isArray(authorPublic.badges) ? authorPublic.badges : [],
        bio: authorPublic.bio || '',
        following: ctx.followedAuthors.has(authorId),
        followers: ctx.followersCountByAuthor[authorId] || 0
      },
      commentCount: pubComments.length,
      commentPreview: rootComments.map((c) => ({
        id: c.id,
        authorName: c.author_name ?? c.authorName,
        authorId: c.author_id ?? c.authorId,
        text: c.text,
        createdAt: c.created_at ?? c.createdAt,
        likeCount: (ctx.likesByComment[c.id] || []).length
      })),
      viewer: {
        favorited: ctx.favoritedSet.has(pub.id),
        voted: ctx.myVotedSet.has(pub.id),
        canVote,
        answered,
        total,
        voteRule: { minPct: 30, minCards: 20 },
        myReactions: ctx.myReactionsByPub[pub.id] || [],
        cloned: ctx.clonedPubMap.has(pub.id)
      },
      remixCount: 0
    }
  }

  function mapCommentView(row, likesByComment, userId) {
    const likes = likesByComment[row.id] || []
    const authorId = row.author_id ?? row.authorId
    return {
      id: row.id,
      parentId: row.parent_id ?? row.parentId ?? null,
      authorId,
      authorName: row.author_name ?? row.authorName,
      isMine: Boolean(userId && authorId === userId),
      text: row.text,
      createdAt: row.created_at ?? row.createdAt,
      likeCount: likes.length,
      liked: Boolean(userId && likes.includes(userId))
    }
  }

  return {
    async publishDeck(
      db,
      user,
      deckId,
      { acceptPolicy = false, description = '' } = {},
      auditRepo = null
    ) {
      if (user.deactivatedAt) {
        return { deactivated: true }
      }
      if (!user?.verified?.email) {
        return { verificationRequired: true }
      }

      const { data: consentRow, error: consentErr } = await db
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (consentErr) throw consentErr

      const acceptedVersion =
        consentRow?.content_policy_accepted_version ??
        consentRow?.contentPolicyAcceptedVersion ??
        null

      if (acceptedVersion !== CONTENT_POLICY_VERSION) {
        if (!acceptPolicy) {
          return {
            policyRequired: true,
            policyVersion: CONTENT_POLICY_VERSION,
            summary: CONTENT_POLICY_SUMMARY
          }
        }
        const nowAccept = nowIso()
        const { error: upsertConsentErr } = await db.from('user_consents').upsert(
          {
            user_id: user.id,
            content_policy_accepted_version: CONTENT_POLICY_VERSION,
            content_policy_accepted_at: nowAccept,
            updated_at: nowAccept
          },
          { onConflict: 'user_id' }
        )
        if (upsertConsentErr) throw upsertConsentErr
      }

      const { data: deckRow, error: deckErr } = await db
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (deckErr) throw deckErr
      if (!deckRow) return { notFound: true }

      const { data: cardRows, error: cardErr } = await db
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .order('position', { ascending: true })
      if (cardErr) throw cardErr
      if (!cardRows || cardRows.length === 0) {
        return { emptyDeck: true }
      }

      const { data: existingPub, error: pubLookupErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('deck_id', deckId)
        .maybeSingle()
      if (pubLookupErr) throw pubLookupErr

      const pubId = existingPub?.id || id('pub')
      const publicId =
        existingPub?.public_id ||
        existingPub?.publicId ||
        `p-${id('').replace(/^_/, '').slice(0, 8)}`
      const version = existingPub ? Number(existingPub.version ?? 1) + 1 : 1
      const now = nowIso()

      const snapshot = cardRows.map((c, idx) => ({
        id: `${pubId}_c${idx + 1}`,
        sourceCardId: c.id,
        deckId: pubId,
        type: c.type || 'text',
        front: c.front,
        back: c.back,
        media: c.media || null,
        lang: c.lang || deckRow.lang || 'pt-BR'
      }))

      let savedPub = null
      if (existingPub) {
        const { data: updatedPub, error: updErr } = await db
          .from('deck_publications')
          .update({
            author_name: user.name,
            name: deckRow.name,
            description: description || existingPub.description || '',
            category_id: deckRow.category_id || 'outros',
            difficulty: deckRow.difficulty || 'medio',
            lang: deckRow.lang || 'pt-BR',
            tags: Array.isArray(deckRow.tags) ? deckRow.tags : [],
            version,
            card_count: snapshot.length,
            snapshot,
            status: 'aprovado',
            hidden_at: null,
            hidden_reason: null,
            submitted_at: now,
            published_at: now,
            updated_at: now
          })
          .eq('id', existingPub.id)
          .select('*')
          .single()
        if (updErr) throw updErr
        savedPub = updatedPub
      } else {
        const { data: insertedPub, error: insErr } = await db
          .from('deck_publications')
          .insert({
            id: pubId,
            deck_id: deckRow.id,
            public_id: publicId,
            author_id: user.id,
            author_name: user.name,
            name: deckRow.name,
            description: description || '',
            category_id: deckRow.category_id || 'outros',
            difficulty: deckRow.difficulty || 'medio',
            lang: deckRow.lang || 'pt-BR',
            tags: Array.isArray(deckRow.tags) ? deckRow.tags : [],
            version: 1,
            card_count: snapshot.length,
            snapshot,
            status: 'aprovado',
            hidden_at: null,
            hidden_reason: null,
            stats: defaultStats(),
            reactions: defaultReactions(),
            submitted_at: now,
            published_at: now,
            updated_at: now
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        savedPub = insertedPub
      }

      const publicationMeta = {
        status: 'aprovado',
        version,
        publicationId: savedPub.id,
        publicId: savedPub.public_id ?? savedPub.publicId,
        publishedAt: now
      }

      const { data: updatedDeckRow, error: updDeckErr } = await db
        .from('decks')
        .update({
          publication_meta: publicationMeta,
          updated_at: now
        })
        .eq('id', deckRow.id)
        .eq('owner_id', user.id)
        .select('*')
        .single()
      if (updDeckErr) throw updDeckErr

      if (auditRepo) {
        await auditRepo.append(user.id, 'publication_submitted', {
          publicationId: savedPub.id,
          deckId: deckRow.id,
          version,
          status: 'aprovado'
        })
      }

      return {
        publication: {
          id: savedPub.id,
          deckId: savedPub.deck_id ?? savedPub.deckId,
          publicId: savedPub.public_id ?? savedPub.publicId,
          authorId: savedPub.author_id ?? savedPub.authorId,
          authorName: savedPub.author_name ?? savedPub.authorName,
          name: savedPub.name,
          categoryId: savedPub.category_id ?? savedPub.categoryId,
          difficulty: savedPub.difficulty,
          lang: savedPub.lang,
          tags: Array.isArray(savedPub.tags) ? savedPub.tags : [],
          version: Number(savedPub.version ?? 1),
          cardCount: Number(savedPub.card_count ?? snapshot.length),
          snapshot,
          status: 'aprovado',
          hiddenAt: null,
          slaHours: 0,
          submittedAt: savedPub.submitted_at ?? savedPub.submittedAt,
          publishedAt: savedPub.published_at ?? savedPub.publishedAt,
          decision: {
            by: 'auto_moderation',
            at: savedPub.published_at ?? savedPub.publishedAt
          }
        },
        deck: mapDeckRow(updatedDeckRow || { ...deckRow, publication_meta: publicationMeta }, cardRows, CATEGORY_MAP),
        sla: { hours: 0, dueAt: now }
      }
    },

    async getFeed(db, user, { rankings = false } = {}) {
      const { data: pubRows, error } = await db
        .from('deck_publications')
        .select('*')
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .order('published_at', { ascending: false })
      if (error) throw error

      const visibleRows = (pubRows || []).filter(
        (p) => (p.status || 'aprovado') === 'aprovado' && !p.hidden_at && !p.hiddenAt
      )
      const ctx = await loadCommunityContext(db, user, visibleRows)
      const decks = visibleRows.map((p) => mapPublicationWithContext(p, ctx, user))

      const highlights = decks
        .slice()
        .sort((a, b) => (b.stats?.votes || 0) - (a.stats?.votes || 0))
        .slice(0, 4)

      const following = decks.filter((d) => ctx.followedAuthors.has(d.authorId))

      const ownCategories = new Set(
        (ctx.ownDecks || []).map((d) => d.category_id ?? d.categoryId)
      )
      const recommendations = decks
        .filter((d) => ownCategories.has(d.categoryId) && !d.viewer.cloned)
        .map((d) => {
          const matchDeck = (ctx.ownDecks || []).find(
            (x) => (x.category_id ?? x.categoryId) === d.categoryId
          )
          return {
            ...d,
            becauseDeck: matchDeck?.name || 'Seus estudos'
          }
        })

      const latest = decks
        .slice()
        .sort(
          (a, b) =>
            new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        )

      const scoreItem = (i) => {
        const reactSum = Object.values(i.reactions || {}).reduce((s, n) => s + Number(n || 0), 0)
        return (
          reactSum * 3 +
          (i.commentCount || 0) * 6 +
          (i.stats?.studiedWeek || 0) +
          (i.stats?.favorites || 0) * 2
        )
      }
      const trending = decks.slice().sort((a, b) => scoreItem(b) - scoreItem(a)).slice(0, 6)

      const rankingWeek = rankings
        ? decks
            .slice()
            .sort((a, b) => (b.stats?.studiedWeek || 0) - (a.stats?.studiedWeek || 0))
            .slice(0, 10)
            .map((d, idx) => ({
              position: idx + 1,
              deckId: d.id,
              name: d.name,
              author: d.author,
              studiedWeek: d.stats?.studiedWeek || 0,
              votes: d.stats?.votes || 0
            }))
        : []

      return {
        highlights,
        following,
        rankingWeek,
        creatorOfMonth: null,
        recommendations,
        latest,
        trending,
        materials: {},
        counts: {
          all: decks.length,
          flashcards: decks.length
        },
        sources: [],
        categories: CATEGORIES,
        materializedAt: nowIso(),
        rules: {
          rankingMetric:
            'Pessoas únicas que estudaram o deck nos últimos 7 dias (com mínimo de 5 cards respondidos).',
          creatorMetric:
            'Soma ponderada de novos alunos nos decks publicados e avaliações positivas no mês.',
          voteRequirement:
            'Só pode votar quem respondeu pelo menos 30% do deck ou 20 cards.'
        }
      }
    },

    async search(
      db,
      user,
      { q = '', category = null, difficulty = null, sort = 'relevance', approved = '' } = {}
    ) {
      const trimmed = String(q || '').trim().toLowerCase()
      const { data: pubRows, error } = await db
        .from('deck_publications')
        .select('*')
        .eq('status', 'aprovado')
        .is('hidden_at', null)
      if (error) throw error

      const visibleRows = (pubRows || []).filter(
        (p) => (p.status || 'aprovado') === 'aprovado' && !p.hidden_at && !p.hiddenAt
      )
      const ctx = await loadCommunityContext(db, user, visibleRows)
      const decks = visibleRows.map((p) => mapPublicationWithContext(p, ctx, user))

      let results = decks.filter((d) => {
        if (category && d.categoryId !== category) return false
        if (difficulty && d.difficulty !== difficulty) return false
        if (approved === '1' && !d.approved) return false
        if (!trimmed) return true
        return (
          d.name.toLowerCase().includes(trimmed) ||
          (d.description || '').toLowerCase().includes(trimmed) ||
          (d.tags || []).some((t) => String(t).toLowerCase().includes(trimmed)) ||
          (d.author?.name || '').toLowerCase().includes(trimmed)
        )
      })

      if (sort === 'recent') {
        results.sort(
          (a, b) =>
            new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        )
      } else if (sort === 'rating') {
        results.sort((a, b) => (b.stats?.votes || 0) - (a.stats?.votes || 0))
      } else {
        results.sort((a, b) => (b.stats?.studiedWeek || 0) - (a.stats?.studiedWeek || 0))
      }

      return {
        results,
        total: results.length,
        q: String(q || '').trim(),
        filters: {
          categories: CATEGORIES,
          difficulties: ['facil', 'medio', 'dificil'],
          kinds: ['flashcards']
        }
      }
    },

    async getDeckDetail(db, user, pubId) {
      const { data: pubRow, error } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (error) throw error
      if (!pubRow || (pubRow.status || 'aprovado') !== 'aprovado' || pubRow.hidden_at || pubRow.hiddenAt) {
        return null
      }

      const ctx = await loadCommunityContext(db, user, [pubRow])
      const deck = mapPublicationWithContext(pubRow, ctx, user)
      const cards = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      const clonedFrom = ctx.clonedPubMap.get(pubRow.id)
      const userLocale = user?.locale || 'pt-BR'

      return {
        deck,
        cards,
        translation: {
          available: (pubRow.lang || 'pt-BR') !== userLocale,
          from: pubRow.lang || 'pt-BR',
          to: userLocale,
          cached: true
        },
        versions: [
          {
            version: Number(pubRow.version ?? 1),
            publishedAt: pubRow.published_at ?? pubRow.publishedAt ?? pubRow.created_at,
            cardCount: cards.length,
            note: 'Versão publicada na comunidade.'
          }
        ],
        newVersionNotice:
          clonedFrom && Number(clonedFrom.version ?? 1) < Number(pubRow.version ?? 1)
            ? {
                clonedVersion: Number(clonedFrom.version ?? 1),
                latestVersion: Number(pubRow.version ?? 1),
                message: 'O autor publicou uma versão mais recente. Sua cópia não foi alterada.'
              }
            : null,
        reactionsList: ALLOWED_REACTIONS,
        remixes: []
      }
    },

    async toggleFavorite(db, user, pubId, { folderId = null } = {}) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const { data: existing, error: favErr } = await db
        .from('deck_favorites')
        .select('*')
        .eq('publication_id', pubId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (favErr) throw favErr

      const stats = defaultStats(pubRow.stats)
      let favorited = false
      if (existing) {
        const { error: delErr } = await db
          .from('deck_favorites')
          .delete()
          .eq('publication_id', pubId)
          .eq('user_id', user.id)
        if (delErr) throw delErr
        stats.favorites = Math.max(0, stats.favorites - 1)
        favorited = false
      } else {
        const { error: insErr } = await db.from('deck_favorites').insert({
          publication_id: pubId,
          user_id: user.id,
          folder_id: folderId || null,
          created_at: nowIso()
        })
        if (insErr) throw insErr
        stats.favorites += 1
        favorited = true
      }

      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ stats, updated_at: nowIso() })
          .eq('id', pubId)
      }

      return { favorited, undoWindowMs: 3000 }
    },

    async cloneDeck(db, user, pubId, { ledgerRepo = null, auditRepo = null } = {}) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const now = nowIso()
      const authorId = pubRow.author_id ?? pubRow.authorId
      const authorName = pubRow.author_name ?? pubRow.authorName
      const version = Number(pubRow.version ?? 1)

      const { data: createdDeck, error: createDeckErr } = await db
        .from('decks')
        .insert({
          owner_id: user.id,
          folder_id: null,
          name: pubRow.name,
          category_id: pubRow.category_id || 'outros',
          tags: Array.isArray(pubRow.tags) ? pubRow.tags : [],
          difficulty: pubRow.difficulty || 'medio',
          lang: pubRow.lang || 'pt-BR',
          scheduled: true,
          difficult: false,
          focus: false,
          complementary: false,
          pinned: false,
          favorite: false,
          source: { type: 'comunidade', document: pubRow.name, pages: null },
          cloned_from: {
            deckId: pubRow.id,
            authorId,
            authorName,
            version
          },
          publication_meta: { status: 'nao_publicado' },
          created_at: now,
          updated_at: now
        })
        .select('*')
        .single()
      if (createDeckErr) throw createDeckErr

      const snapshot = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      if (snapshot.length > 0) {
        const cardsPayload = snapshot.map((c, idx) => ({
          deck_id: createdDeck.id,
          owner_id: user.id,
          type: c.type || 'text',
          front: c.front,
          back: c.back,
          media: c.media || null,
          lang: c.lang || pubRow.lang || 'pt-BR',
          origin: {
            document: `Comunidade · ${authorName}`,
            page: null,
            excerpt: null,
            model: null,
            reader: null,
            promptVersion: null
          },
          uncertain: false,
          position: idx,
          sched_state: 'new',
          sched_stability: 0,
          sched_difficulty: 5,
          sched_due: now,
          sched_last_review: null,
          sched_reps: 0,
          sched_lapses: 0,
          sched_consecutive_lapses: 0,
          created_at: now
        }))
        const { error: cardsErr } = await db.from('cards').insert(cardsPayload)
        if (cardsErr) throw cardsErr
      }

      const stats = defaultStats(pubRow.stats)
      stats.clones += 1
      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ stats, updated_at: now })
          .eq('id', pubId)
      }

      if (authorId && authorId !== user.id && ledgerRepo) {
        await ledgerRepo.credit(
          authorId,
          5,
          'clone_bonus',
          { deckId: pubRow.id, clonedBy: user.id },
          `clone_bonus:${pubRow.id}:${user.id}`
        )
      }

      if (auditRepo) {
        await auditRepo.append(user.id, 'deck_cloned', {
          sourceDeckId: pubRow.id,
          newDeckId: createdDeck.id
        })
      }

      return {
        deckId: createdDeck.id,
        credit: { authorName, bonus: 5 }
      }
    },

    async toggleVote(db, user, pubId) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const { data: studyRow, error: studyErr } = await db
        .from('study_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (studyErr) throw studyErr

      const communityAnswered =
        studyRow?.community_answered || studyRow?.communityAnswered || {}
      const answered = Number(communityAnswered[pubId] ?? 0)
      const snapshot = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      const total = Number(pubRow.card_count ?? pubRow.cardCount ?? snapshot.length)
      const canVote = answered >= 20 || (total > 0 && answered / total >= 0.3)

      if (!canVote) {
        return { voteNotAllowed: true, answered, total }
      }

      const { data: existingVote, error: voteErr } = await db
        .from('deck_votes')
        .select('*')
        .eq('publication_id', pubId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (voteErr) throw voteErr

      const stats = defaultStats(pubRow.stats)
      let voted = false
      if (existingVote) {
        const { error: delErr } = await db
          .from('deck_votes')
          .delete()
          .eq('publication_id', pubId)
          .eq('user_id', user.id)
        if (delErr) throw delErr
        stats.votes = Math.max(0, stats.votes - 1)
        voted = false
      } else {
        const { error: insErr } = await db.from('deck_votes').insert({
          publication_id: pubId,
          user_id: user.id,
          weight: 1,
          created_at: nowIso()
        })
        if (insErr) throw insErr
        stats.votes += 1
        voted = true
      }

      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ stats, updated_at: nowIso() })
          .eq('id', pubId)
      }

      return { voted, votes: stats.votes }
    },

    async toggleReaction(db, user, pubId, emoji) {
      if (!ALLOWED_REACTIONS.includes(emoji)) {
        return { invalidEmoji: true }
      }

      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const { data: myRows, error: reactErr } = await db
        .from('deck_reactions')
        .select('*')
        .eq('publication_id', pubId)
        .eq('user_id', user.id)
      if (reactErr) throw reactErr

      const reactions = defaultReactions(pubRow.reactions)
      const existing = (myRows || []).find((r) => r.emoji === emoji)
      let mine = (myRows || []).map((r) => r.emoji)

      if (existing) {
        const { error: delErr } = await db
          .from('deck_reactions')
          .delete()
          .eq('publication_id', pubId)
          .eq('user_id', user.id)
          .eq('emoji', emoji)
        if (delErr) throw delErr
        reactions[emoji] = Math.max(0, Number(reactions[emoji] ?? 0) - 1)
        mine = mine.filter((e) => e !== emoji)
      } else {
        const { error: insErr } = await db.from('deck_reactions').insert({
          publication_id: pubId,
          user_id: user.id,
          emoji,
          created_at: nowIso()
        })
        if (insErr) throw insErr
        reactions[emoji] = Number(reactions[emoji] ?? 0) + 1
        mine = [...mine, emoji]
      }

      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ reactions, updated_at: nowIso() })
          .eq('id', pubId)
      }

      return { reactions, mine }
    },

    async shareDeck(db, user, pubId, { channel = 'copy', auditRepo = null } = {}) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      if (auditRepo) {
        await auditRepo.append(user.id, 'deck_shared', {
          deckId: pubRow.id,
          channel
        })
      }

      const snapshot = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      return {
        url: `/d/${pubRow.public_id ?? pubRow.publicId}`,
        preview: {
          name: pubRow.name,
          authorName: pubRow.author_name ?? pubRow.authorName,
          cardCount: Number(pubRow.card_count ?? pubRow.cardCount ?? snapshot.length)
        },
        requiresLoginToStudy: true
      }
    },

    async reportDeck(db, user, pubId, { reason, detail = null } = {}, auditRepo = null) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const now = nowIso()
      const reportId = id('rep')
      const { data: inserted, error: repErr } = await db
        .from('moderation_reports')
        .insert({
          id: reportId,
          target_type: 'deck',
          target_id: pubRow.id,
          publication_id: pubRow.id,
          comment_id: null,
          target_name: pubRow.name,
          reason,
          detail: detail || null,
          reporter_id: user.id,
          status: 'aberta',
          created_at: now
        })
        .select('*')
        .single()
      if (repErr) throw repErr

      if (auditRepo) {
        await auditRepo.append(user.id, 'report_created', {
          reportId: inserted.id,
          deckId: pubRow.id,
          reason
        })
      }

      return {
        report: {
          id: inserted.id,
          targetType: 'deck',
          targetId: pubRow.id,
          targetName: pubRow.name,
          reason: inserted.reason,
          detail: inserted.detail || null,
          reporterId: user.id,
          status: inserted.status || 'aberta',
          createdAt: inserted.created_at ?? now
        },
        message:
          'Denúncia registrada. Um moderador vai revisar e você recebe o resultado com o motivo.'
      }
    },

    async translateDeck(db, _user, pubId, lang) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const snapshot = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      return {
        lang,
        from: pubRow.lang || 'pt-BR',
        cards: snapshot.map((c) => ({ id: c.id, translated: null })),
        cached: true,
        notice:
          'Tradução automática na camada de apresentação — o conteúdo original permanece intacto.'
      }
    },

    async listComments(db, user, pubId) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('id, status, hidden_at')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const [{ data: commentRows, error: cmErr }, { data: likeRows, error: lkErr }] =
        await Promise.all([
          db
            .from('deck_comments')
            .select('*')
            .eq('publication_id', pubId)
            .is('hidden_at', null)
            .order('created_at', { ascending: true }),
          db.from('comment_likes').select('*')
        ])
      if (cmErr) throw cmErr
      if (lkErr) throw lkErr

      const visibleComments = (commentRows || []).filter((c) => !c.hidden_at && !c.hiddenAt)
      const likesByComment = {}
      for (const l of likeRows || []) {
        const cId = l.comment_id ?? l.commentId
        if (!likesByComment[cId]) likesByComment[cId] = []
        likesByComment[cId].push(l.user_id ?? l.userId)
      }

      const views = visibleComments.map((c) => mapCommentView(c, likesByComment, user?.id))
      const roots = views.filter((c) => !c.parentId)
      const threads = roots.map((root) => ({
        ...root,
        replies: views.filter((r) => r.parentId === root.id)
      }))

      return { threads, total: visibleComments.length }
    },

    async createComment(db, user, pubId, { text, parentId = null } = {}) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const now = nowIso()
      const commentId = id('cm')
      const { data: inserted, error: insErr } = await db
        .from('deck_comments')
        .insert({
          id: commentId,
          publication_id: pubId,
          parent_id: parentId || null,
          author_id: user.id,
          author_name: user.name,
          text,
          hidden_at: null,
          created_at: now
        })
        .select('*')
        .single()
      if (insErr) throw insErr

      const stats = defaultStats(pubRow.stats)
      stats.comments += 1
      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ stats, updated_at: now })
          .eq('id', pubId)
      }

      const authorId = pubRow.author_id ?? pubRow.authorId
      return {
        comment: mapCommentView(inserted, {}, user.id),
        notifiedAuthor: authorId !== user.id
      }
    },

    async toggleCommentLike(db, user, commentId) {
      const { data: commentRow, error: cmErr } = await db
        .from('deck_comments')
        .select('*')
        .eq('id', commentId)
        .is('hidden_at', null)
        .maybeSingle()
      if (cmErr) throw cmErr
      if (!commentRow || commentRow.hidden_at || commentRow.hiddenAt) return null

      const { data: existing, error: lkErr } = await db
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (lkErr) throw lkErr

      if (existing) {
        const { error: delErr } = await db
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
        if (delErr) throw delErr
      } else {
        const { error: insErr } = await db.from('comment_likes').insert({
          comment_id: commentId,
          user_id: user.id,
          created_at: nowIso()
        })
        if (insErr) throw insErr
      }

      const { data: allLikes, error: allErr } = await db
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
      if (allErr) throw allErr

      const likesByComment = {
        [commentId]: (allLikes || []).map((l) => l.user_id ?? l.userId)
      }

      return mapCommentView(commentRow, likesByComment, user.id)
    },

    async reportComment(db, user, commentId, { reason = 'Outro', detail = null } = {}) {
      const { data: commentRow, error: cmErr } = await db
        .from('deck_comments')
        .select('*')
        .eq('id', commentId)
        .is('hidden_at', null)
        .maybeSingle()
      if (cmErr) throw cmErr
      if (!commentRow || commentRow.hidden_at || commentRow.hiddenAt) return null

      const now = nowIso()
      const reportId = id('rep')
      const pubId = commentRow.publication_id ?? commentRow.publicationId ?? null
      const { data: inserted, error: repErr } = await db
        .from('moderation_reports')
        .insert({
          id: reportId,
          target_type: 'comment',
          target_id: commentId,
          publication_id: pubId,
          comment_id: commentId,
          target_name: 'Comentário',
          reason,
          detail: detail || null,
          reporter_id: user.id,
          status: 'aberta',
          created_at: now
        })
        .select('*')
        .single()
      if (repErr) throw repErr

      return {
        report: {
          id: inserted.id,
          targetType: 'comment',
          targetId: commentId,
          targetName: 'Comentário',
          reason: inserted.reason,
          detail: inserted.detail || null,
          reporterId: user.id,
          status: inserted.status || 'aberta',
          createdAt: inserted.created_at ?? now
        },
        message: 'Comentário enviado para análise automática.'
      }
    },

    async getAuthorProfile(db, user, authorId) {
      const svc = getService(db)
      const [
        { data: pubRows, error: pubErr },
        { data: followRows, error: flErr },
        profileRes
      ] = await Promise.all([
        db
          .from('deck_publications')
          .select('*')
          .eq('author_id', authorId)
          .eq('status', 'aprovado')
          .is('hidden_at', null)
          .order('published_at', { ascending: false }),
        db.from('author_follows').select('*').eq('author_id', authorId),
        svc
          ? svc
              .from('profiles')
              .select('id, name, public_profile')
              .eq('id', authorId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ])
      if (pubErr) throw pubErr
      if (flErr) throw flErr

      const visiblePubs = (pubRows || []).filter(
        (p) => (p.status || 'aprovado') === 'aprovado' && !p.hidden_at && !p.hiddenAt
      )
      const profileRow = profileRes?.data || null
      if (!profileRow && visiblePubs.length === 0) {
        return null
      }

      const ctx = await loadCommunityContext(db, user, visiblePubs)
      const decks = visiblePubs.map((p) => mapPublicationWithContext(p, ctx, user))

      const authorName =
        profileRow?.name ||
        visiblePubs[0]?.author_name ||
        visiblePubs[0]?.authorName ||
        'Autor'
      const publicProfile = {
        ...DEFAULT_PUBLIC_PROFILE,
        ...(profileRow?.public_profile || profileRow?.publicProfile || {})
      }
      const followers = (followRows || []).length
      const following = (followRows || []).some(
        (f) => (f.follower_id ?? f.followerId) === user?.id
      )

      const badges = Array.isArray(publicProfile.badges) ? publicProfile.badges : []

      return {
        author: {
          id: authorId,
          name: authorName,
          handle: String(authorName).toLowerCase().replace(/\s+/g, '.'),
          level: Number(publicProfile.level ?? 1),
          topic: publicProfile.topic || 'Geral',
          points: Number(publicProfile.points ?? 0),
          badges,
          cardsGenerated: Number(publicProfile.cardsGenerated ?? 0),
          bio: publicProfile.bio || '',
          followers,
          following,
          decksCount: decks.length,
          neuronsTotal: Number(publicProfile.points ?? 0)
        },
        decks,
        badgesShown: badges.slice(0, 3),
        badgesTotal: badges.length
      }
    },

    async toggleFollowAuthor(db, user, authorId) {
      const { data: existing, error: flErr } = await db
        .from('author_follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('author_id', authorId)
        .maybeSingle()
      if (flErr) throw flErr

      let following = false
      if (existing) {
        const { error: delErr } = await db
          .from('author_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('author_id', authorId)
        if (delErr) throw delErr
        following = false
      } else {
        const { error: insErr } = await db.from('author_follows').insert({
          follower_id: user.id,
          author_id: authorId,
          created_at: nowIso()
        })
        if (insErr) throw insErr
        following = true
      }

      const { data: allFollows, error: countErr } = await db
        .from('author_follows')
        .select('*')
        .eq('author_id', authorId)
      if (countErr) throw countErr

      return { following, followers: (allFollows || []).length }
    },

    async startCommunityStudy(db, user, pubId) {
      const { data: pubRow, error: pubErr } = await db
        .from('deck_publications')
        .select('*')
        .eq('id', pubId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (pubErr) throw pubErr
      if (!pubRow || pubRow.hidden_at || pubRow.hiddenAt) return null

      const stats = defaultStats(pubRow.stats)
      stats.studiedWeek += 1
      const svc = getService(db)
      if (svc) {
        await svc
          .from('deck_publications')
          .update({ stats, updated_at: nowIso() })
          .eq('id', pubId)
      }

      const ctx = await loadCommunityContext(db, user, [{ ...pubRow, stats }])
      const deck = mapPublicationWithContext({ ...pubRow, stats }, ctx, user)
      const cards = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []

      return { cards, deck }
    },

    async getPublicDeckPreview(db, publicId) {
      const reader = getService(db)
      if (!reader) return null
      const { data: pubRow, error } = await reader
        .from('deck_publications')
        .select('*')
        .eq('public_id', publicId)
        .eq('status', 'aprovado')
        .is('hidden_at', null)
        .maybeSingle()
      if (error) throw error
      if (!pubRow || (pubRow.status || 'aprovado') !== 'aprovado' || pubRow.hidden_at || pubRow.hiddenAt) {
        return null
      }

      const snapshot = Array.isArray(pubRow.snapshot) ? pubRow.snapshot : []
      const categoryId = pubRow.category_id ?? pubRow.categoryId ?? 'outros'

      return {
        preview: {
          id: pubRow.id,
          kind: 'community',
          name: pubRow.name,
          authorName: pubRow.author_name ?? pubRow.authorName,
          categoryName: CATEGORY_MAP[categoryId] || 'Outros',
          difficulty: pubRow.difficulty || 'medio',
          cardCount: Number(pubRow.card_count ?? pubRow.cardCount ?? snapshot.length),
          sample: snapshot.slice(0, 3).map((c) => c.front),
          version: Number(pubRow.version ?? 1),
          lang: pubRow.lang || 'pt-BR'
        },
        requiresLogin: true
      }
    },

    async hideTarget(
      db,
      { targetType, targetId, reason = 'Conteúdo ocultado pela moderação' }
    ) {
      const svc = getService(db)
      if (!svc) throw new Error('service_client_required')
      const now = nowIso()

      if (typeof svc.rpc === 'function') {
        const { error: rpcErr } = await svc.rpc('moderate_hide_target', {
          p_target_type: targetType,
          p_target_id: targetId,
          p_reason: reason
        })
        if (!rpcErr) return { ok: true, hiddenAt: now }
      }

      if (targetType === 'deck') {
        await svc
          .from('deck_publications')
          .update({ hidden_at: now, hidden_reason: reason, updated_at: now })
          .eq('id', targetId)
      } else if (targetType === 'comment') {
        await svc
          .from('deck_comments')
          .update({ hidden_at: now, hidden_reason: reason })
          .eq('id', targetId)
      }

      await svc
        .from('moderation_reports')
        .update({ status: 'oculta', resolved_at: now })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('status', 'aberta')

      return { ok: true, hiddenAt: now }
    }
  }
}
