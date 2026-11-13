import { PLAN_LIMITS } from '../lib/helpers.js'
import { nowIso } from '../lib/ids.js'
import { CATEGORIES } from '../seed/content.js'
import { mapCardRow, mapDeckRow } from './mappers.js'

export const DECK_LIMITS = {
  cardsPerDeck: 2000,
  folderDepth: 3,
  decksPerFolder: 500,
  membersPerFolder: 50,
  imageKB: 2048,
  audioSeconds: 60
}

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]))

function computeFolderDepth(allFolders, folderId) {
  let depth = 0
  let current = allFolders.find((f) => f.id === folderId)
  const visited = new Set()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    depth += 1
    const parentId = current.parent_id ?? current.parentId ?? null
    current = parentId ? allFolders.find((f) => f.id === parentId) : null
  }
  return depth
}

export function mapFolderRow(row, allFolders = [], decks = [], favorites = []) {
  if (!row) return null
  const deckIds = [
    ...decks.filter((d) => d.folderId === row.id).map((d) => d.id),
    ...favorites.filter((d) => d.folderId === row.id).map((d) => d.id)
  ]
  return {
    id: row.id,
    ownerId: row.owner_id ?? row.ownerId,
    name: row.name,
    parentId: row.parent_id ?? row.parentId ?? null,
    createdAt: row.created_at ?? row.createdAt,
    shared: false,
    members: [],
    depth: computeFolderDepth(allFolders, row.id),
    deckIds
  }
}

export function mapPublicationRow(pub) {
  if (!pub) return null
  return {
    id: pub.id,
    deckId: pub.deck_id ?? pub.deckId,
    publicId: pub.public_id ?? pub.publicId,
    authorId: pub.author_id ?? pub.authorId,
    authorName: pub.author_name ?? pub.authorName,
    name: pub.name,
    description: pub.description || '',
    categoryId: pub.category_id ?? pub.categoryId ?? 'outros',
    difficulty: pub.difficulty || 'medio',
    lang: pub.lang || 'pt-BR',
    tags: Array.isArray(pub.tags) ? pub.tags : [],
    version: Number(pub.version ?? 1),
    cardCount: Number(pub.card_count ?? pub.cardCount ?? (pub.snapshot || []).length),
    snapshot: Array.isArray(pub.snapshot) ? pub.snapshot : [],
    status: pub.status || 'aprovado',
    submittedAt: pub.submitted_at ?? pub.submittedAt,
    publishedAt: pub.published_at ?? pub.publishedAt
  }
}

export function createDecksRepo() {
  return {
    async listLibrary(db, user) {
      const [
        { data: deckRows, error: deckErr },
        { data: cardRows, error: cardErr },
        { data: folderRows, error: folderErr },
        { data: favRows, error: favErr }
      ] = await Promise.all([
        db
          .from('decks')
          .select('*')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        db
          .from('cards')
          .select('*')
          .eq('owner_id', user.id)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        db
          .from('folders')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true }),
        db
          .from('deck_favorites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ])
      if (deckErr) throw deckErr
      if (cardErr) throw cardErr
      if (folderErr) throw folderErr
      if (favErr) throw favErr

      const cardsByDeck = {}
      for (const c of cardRows || []) {
        const dId = c.deck_id ?? c.deckId
        if (!cardsByDeck[dId]) cardsByDeck[dId] = []
        cardsByDeck[dId].push(c)
      }

      const decks = (deckRows || []).map((row) =>
        mapDeckRow(row, cardsByDeck[row.id] || [], CATEGORY_MAP)
      )

      let favorites = []
      if (Array.isArray(favRows) && favRows.length > 0) {
        const { data: pubRows, error: pubErr } = await db
          .from('deck_publications')
          .select('*')
          .eq('status', 'aprovado')
          .is('hidden_at', null)
        if (pubErr) throw pubErr
        const pubById = Object.fromEntries((pubRows || []).map((p) => [p.id, p]))
        favorites = favRows
          .map((f) => {
            const pub = pubById[f.publication_id]
            if (!pub) return null
            const categoryId = pub.category_id || 'outros'
            return {
              id: pub.id,
              publicId: pub.public_id,
              name: pub.name,
              description: pub.description || '',
              categoryId,
              categoryName: CATEGORY_MAP[categoryId] || 'Outros',
              difficulty: pub.difficulty || 'medio',
              tags: Array.isArray(pub.tags) ? pub.tags : [],
              cardCount: Number(pub.card_count ?? (pub.snapshot || []).length),
              authorId: pub.author_id,
              author: { id: pub.author_id, name: pub.author_name },
              stats: pub.stats || {
                studiedWeek: 0,
                votes: 0,
                favorites: 0,
                comments: 0,
                clones: 0
              },
              reactions: pub.reactions || {},
              favorite: true,
              folderId: f.folder_id || null,
              favoritedAt: f.created_at
            }
          })
          .filter(Boolean)
      }

      const allFolders = folderRows || []
      const folders = allFolders.map((f) => mapFolderRow(f, allFolders, decks, favorites))
      const planLimits = PLAN_LIMITS[user.plan || 'free'] || PLAN_LIMITS.free

      return {
        decks,
        favorites,
        folders,
        limits: {
          ...DECK_LIMITS,
          pinLimit: planLimits.pinLimit,
          pinned: decks.filter((d) => d.pinned).length
        },
        categories: CATEGORIES
      }
    },

    async createDeck(
      db,
      user,
      {
        name,
        categoryId = 'outros',
        tags = [],
        difficulty = 'medio',
        folderId = null,
        source = null,
        clonedFrom = null
      }
    ) {
      const payload = {
        owner_id: user.id,
        folder_id: folderId || null,
        name: name.trim(),
        category_id: categoryId || 'outros',
        tags: Array.isArray(tags) ? tags : [],
        difficulty: difficulty || 'medio',
        lang: user.locale || 'pt-BR',
        scheduled: true,
        difficult: false,
        focus: false,
        complementary: false,
        pinned: false,
        favorite: false,
        source: source || { type: 'vazio', document: null, pages: null },
        cloned_from: clonedFrom || null,
        publication_meta: { status: 'nao_publicado' }
      }
      const { data: created, error } = await db
        .from('decks')
        .insert(payload)
        .select('*')
        .single()
      if (error) throw error
      return mapDeckRow(created, [], CATEGORY_MAP)
    },

    async getDeckDetail(db, user, deckId, features = {}) {
      const { data: deckRow, error: deckErr } = await db
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (deckErr) throw deckErr
      if (!deckRow) return null

      const [{ data: cardRows, error: cardErr }, folderRes, { data: pubRow, error: pubErr }] =
        await Promise.all([
          db
            .from('cards')
            .select('*')
            .eq('deck_id', deckId)
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .order('position', { ascending: true }),
          deckRow.folder_id
            ? db
                .from('folders')
                .select('*')
                .eq('id', deckRow.folder_id)
                .eq('owner_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          db.from('deck_publications').select('*').eq('deck_id', deckId).maybeSingle()
        ])
      if (cardErr) throw cardErr
      if (folderRes.error) throw folderRes.error
      if (pubErr) throw pubErr

      const deck = mapDeckRow(deckRow, cardRows || [], CATEGORY_MAP)
      const cards = (cardRows || []).map(mapCardRow)
      const publication = mapPublicationRow(pubRow)
      const folder = folderRes.data
        ? {
            id: folderRes.data.id,
            name: folderRes.data.name,
            shared: false,
            members: []
          }
        : null
      const menu = [
        'difficult',
        'focus',
        'complementary',
        ...(features.folderSharing ? ['share_folder'] : []),
        'export',
        deck.publication?.status === 'aprovado' ? 'publish_version' : 'publish'
      ]

      return { deck, cards, publication, folder, menu }
    },

    async updateDeck(db, user, deckId, body = {}) {
      const { data: deckRow, error: findErr } = await db
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (findErr) throw findErr
      if (!deckRow) return { notFound: true }

      if (typeof body.pinned === 'boolean' && body.pinned && !deckRow.pinned) {
        const limit = (PLAN_LIMITS[user.plan || 'free'] || PLAN_LIMITS.free).pinLimit
        const { data: pinnedRows, error: pinErr } = await db
          .from('decks')
          .select('id')
          .eq('owner_id', user.id)
          .eq('pinned', true)
          .is('deleted_at', null)
        if (pinErr) throw pinErr
        if ((pinnedRows || []).length >= limit) {
          return { pinLimitError: { limit, plan: user.plan || 'free' } }
        }
      }

      const patch = {}
      for (const key of ['difficult', 'focus', 'complementary', 'pinned', 'scheduled', 'favorite']) {
        if (typeof body[key] === 'boolean') patch[key] = body[key]
      }
      if (body.name?.trim()) patch.name = body.name.trim()
      if (body.categoryId) patch.category_id = body.categoryId
      if (Array.isArray(body.tags)) patch.tags = body.tags
      if (body.difficulty) patch.difficulty = body.difficulty
      if ('folderId' in body) patch.folder_id = body.folderId || null

      const [{ data: updatedRow, error: updateErr }, { data: cardRows, error: cardErr }] =
        await Promise.all([
          Object.keys(patch).length > 0
            ? db
                .from('decks')
                .update(patch)
                .eq('id', deckId)
                .eq('owner_id', user.id)
                .select('*')
                .maybeSingle()
            : Promise.resolve({ data: deckRow, error: null }),
          db
            .from('cards')
            .select('*')
            .eq('deck_id', deckId)
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .order('position', { ascending: true })
        ])
      if (updateErr) throw updateErr
      if (cardErr) throw cardErr

      return {
        deck: mapDeckRow(updatedRow || { ...deckRow, ...patch }, cardRows || [], CATEGORY_MAP)
      }
    },

    async deleteDeck(db, user, deckId) {
      const { data: existing, error: findErr } = await db
        .from('decks')
        .select('id')
        .eq('id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (findErr) throw findErr
      if (!existing) return false

      const { error } = await db
        .from('decks')
        .update({ deleted_at: nowIso() })
        .eq('id', deckId)
        .eq('owner_id', user.id)
      if (error) throw error
      return true
    },

    async createCard(db, user, deckId, { front, back, type = 'text', media = null }) {
      const { data: deckRow, error: deckErr } = await db
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (deckErr) throw deckErr
      if (!deckRow) return { notFound: true }

      const { data: existingCards, error: countErr } = await db
        .from('cards')
        .select('id')
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
      if (countErr) throw countErr

      const count = (existingCards || []).length
      if (count >= DECK_LIMITS.cardsPerDeck) {
        return { deckLimitError: true }
      }

      const payload = {
        deck_id: deckId,
        owner_id: user.id,
        type: type || 'text',
        front,
        back,
        media: media || null,
        lang: deckRow.lang || 'pt-BR',
        origin: {
          document: 'Criado manualmente',
          page: null,
          excerpt: null,
          model: null,
          promptVersion: null
        },
        uncertain: false,
        position: count,
        sched_state: 'new',
        sched_stability: 0,
        sched_difficulty: 5,
        sched_due: nowIso(),
        sched_last_review: null,
        sched_reps: 0,
        sched_lapses: 0,
        sched_consecutive_lapses: 0
      }

      const { data: inserted, error: insertErr } = await db
        .from('cards')
        .insert(payload)
        .select('*')
        .single()
      if (insertErr) throw insertErr

      return { card: mapCardRow(inserted) }
    },

    async updateCard(db, user, deckId, cardId, { front, back }) {
      const { data: cardRow, error: findErr } = await db
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (findErr) throw findErr
      if (!cardRow) return null

      const patch = {
        edited_at: nowIso(),
        uncertain: false
      }
      if (typeof front === 'string') patch.front = front
      if (typeof back === 'string') patch.back = back

      const { data: updated, error: updateErr } = await db
        .from('cards')
        .update(patch)
        .eq('id', cardId)
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
        .select('*')
        .maybeSingle()
      if (updateErr) throw updateErr

      return mapCardRow(updated || { ...cardRow, ...patch })
    },

    async deleteCard(db, user, deckId, cardId) {
      const { data: cardRow, error: findErr } = await db
        .from('cards')
        .select('id')
        .eq('id', cardId)
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (findErr) throw findErr
      if (!cardRow) return false

      const { error } = await db
        .from('cards')
        .update({ deleted_at: nowIso() })
        .eq('id', cardId)
        .eq('deck_id', deckId)
        .eq('owner_id', user.id)
      if (error) throw error
      return true
    },

    async exportDeck(db, user, deckId, rawFormat = 'pdf') {
      const detail = await this.getDeckDetail(db, user, deckId)
      if (!detail) return null
      const format = rawFormat === 'txt' ? 'txt' : 'pdf'
      const lines = detail.cards.map((c, i) => `${i + 1}. ${c.front}\n   ${c.back}`)
      const text = `Memora · ${detail.deck.name}\n${detail.deck.categoryName} · ${lines.length} cards\n\n${lines.join('\n\n')}`
      const fileName = `${detail.deck.name.replace(/[^\w\dÀ-ÿ-]+/g, '_')}.txt`
      return {
        fileName,
        format,
        url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
        cards: lines.length,
        note: format === 'pdf' ? 'No protótipo, o PDF é entregue como texto.' : null
      }
    },

    async createFolder(db, user, { name, parentId = null }) {
      const { data: allFolders, error: listErr } = await db
        .from('folders')
        .select('*')
        .eq('owner_id', user.id)
      if (listErr) throw listErr

      if (parentId) {
        const parentDepth = computeFolderDepth(allFolders || [], parentId)
        if (parentDepth >= DECK_LIMITS.folderDepth) {
          return { depthError: true }
        }
      }

      const { data: created, error: insertErr } = await db
        .from('folders')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          parent_id: parentId || null
        })
        .select('*')
        .single()
      if (insertErr) throw insertErr

      const updatedFolders = [...(allFolders || []), created]
      return { folder: mapFolderRow(created, updatedFolders) }
    },

    async getFolder(db, user, folderId) {
      const library = await this.listLibrary(db, user)
      const folder = library.folders.find((f) => f.id === folderId) || null
      if (!folder) return null
      const decks = [
        ...library.decks.filter((d) => d.folderId === folderId),
        ...library.favorites.filter((d) => d.folderId === folderId)
      ]
      return { folder, decks }
    },

    async updateFolder(db, user, folderId, { name }) {
      const { data: allFolders, error: listErr } = await db
        .from('folders')
        .select('*')
        .eq('owner_id', user.id)
      if (listErr) throw listErr

      const existing = (allFolders || []).find((f) => f.id === folderId)
      if (!existing) return null

      const nextName = name?.trim() ? name.trim() : existing.name
      const { data: updated, error: updateErr } = await db
        .from('folders')
        .update({ name: nextName })
        .eq('id', folderId)
        .eq('owner_id', user.id)
        .select('*')
        .maybeSingle()
      if (updateErr) throw updateErr

      const row = updated || { ...existing, name: nextName }
      return mapFolderRow(
        row,
        (allFolders || []).map((f) => (f.id === folderId ? row : f))
      )
    },

    async deleteFolder(db, user, folderId) {
      const { data: existing, error: findErr } = await db
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('owner_id', user.id)
        .maybeSingle()
      if (findErr) throw findErr
      if (!existing) return false

      const { error } = await db
        .from('folders')
        .delete()
        .eq('id', folderId)
        .eq('owner_id', user.id)
      if (error) throw error
      return true
    },

    async assignDeckToFolder(db, user, folderId, deckId) {
      if (folderId) {
        const { data: folder, error: folderErr } = await db
          .from('folders')
          .select('id')
          .eq('id', folderId)
          .eq('owner_id', user.id)
          .maybeSingle()
        if (folderErr) throw folderErr
        if (!folder) return { folderNotFound: true }
      }
      const res = await this.updateDeck(db, user, deckId, { folderId: folderId || null })
      if (res.notFound) return { deckNotFound: true }
      return { deck: res.deck }
    }
  }
}
