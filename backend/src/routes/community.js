import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, communityDeckPublic, authorPublic, materializedAt, guardianGate, requireVerified, categoryName, ownDecksOf } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'
import { credit } from '../lib/ledger.js'
import { appendAudit } from '../lib/audit.js'

function withAuthor(state, deck, viewerId) {
  return communityDeckPublic(state, deck, viewerId)
}

export function communityRoutes() {
  const r = Router()

  r.get('/community/feed', requireStudent, (req, res) => {
    const state = req.store.state
    const viewer = req.user.id
    const decks = state.community.decks.map((d) => withAuthor(state, d, viewer))
    const highlights = decks.slice().sort((a, b) => b.stats.studiedWeek + b.stats.votes * 2 - (a.stats.studiedWeek + a.stats.votes * 2))
    const followed = state.community.follows.filter((f) => f.userId === viewer).map((f) => f.authorId)
    const following = decks.filter((d) => followed.includes(d.authorId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    const rankingWeek = decks.slice().sort((a, b) => b.stats.studiedWeek - a.stats.studiedWeek).slice(0, 5).map((d, i) => ({ position: i + 1, deckId: d.id, name: d.name, authorName: d.author?.name, studiedWeek: d.stats.studiedWeek, categoryName: d.categoryName }))
    const creator = state.community.authors.find((a) => a.creatorOfMonth)
    const creatorOfMonth = creator ? { ...authorPublic(state, creator, viewer), topDecks: decks.filter((d) => d.authorId === creator.id).slice(0, 2).map((d) => ({ id: d.id, name: d.name })) } : null
    const own = ownDecksOf(state, viewer)
    const favIds = new Set(state.community.favorites.filter((f) => f.userId === viewer).map((f) => f.deckId))
    const lower = (list) => list.map((x) => x.toLowerCase())
    const recommendations = decks
      .filter((d) => !favIds.has(d.id) && d.authorId !== viewer)
      .map((d) => {
        const because = own.find((o) => o.categoryId === d.categoryId || lower(o.tags).some((tg) => lower(d.tags).includes(tg)))
        return because ? { ...d, becauseDeck: because.name } : null
      })
      .filter(Boolean)
      .slice(0, 4)
    res.json({ highlights, following, rankingWeek, creatorOfMonth, recommendations, materializedAt: materializedAt(), rules: { maxSessionsPerPersonPerDeckPerDay: 1, ignoresAuthorAndClones: true, refreshMinutes: 15 } })
  })

  r.get('/community/search', requireStudent, (req, res) => {
    const state = req.store.state
    const q = String(req.query.q || '').trim().toLowerCase()
    const category = req.query.category ? String(req.query.category) : null
    const difficulty = req.query.difficulty ? String(req.query.difficulty) : null
    const sort = String(req.query.sort || 'relevance')
    let results = state.community.decks.map((d) => withAuthor(state, d, req.user.id))
    if (q) {
      results = results
        .map((d) => {
          const hay = `${d.name} ${d.description} ${d.tags.join(' ')} ${d.author?.name || ''} ${d.categoryName}`.toLowerCase()
          const score = d.name.toLowerCase().includes(q) ? 3 : hay.includes(q) ? 1 : 0
          return { ...d, score }
        })
        .filter((d) => d.score > 0)
    }
    if (category) results = results.filter((d) => d.categoryId === category)
    if (difficulty) results = results.filter((d) => d.difficulty === difficulty)
    if (String(req.query.approved || '') === '1') results = results.filter((d) => (d.author?.badges || []).length > 0)
    if (sort === 'recent') results.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    else if (sort === 'rating') results.sort((a, b) => b.stats.votes - a.stats.votes)
    else results.sort((a, b) => (b.score || 0) - (a.score || 0) || b.stats.studiedWeek - a.stats.studiedWeek)
    res.json({ results, total: results.length, q, filters: { categories: state.categories, difficulties: ['facil', 'medio', 'dificil'], sorts: ['relevance', 'recent', 'rating'] } })
  })

  r.get('/community/decks/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const detail = withAuthor(state, deck, req.user.id)
    const cards = state.community.cards.filter((c) => c.deckId === deck.id).map((c) => ({ ...c, hasTranslation: Boolean(c.translation?.[req.user.locale]) }))
    const studiedVersion = state.community.answered[req.user.id]?.[deck.id] ? Math.max(1, deck.version - 1) : null
    res.json({
      deck: detail,
      cards,
      translation: { available: deck.lang !== req.user.locale, from: deck.lang, to: req.user.locale, cached: true, notice: 'Tradução automática. O moderador revisa apenas o original.' },
      versions: Array.from({ length: deck.version }, (_, i) => ({ version: i + 1, publishedAt: deck.publishedAt, current: i + 1 === deck.version })),
      newVersionNotice: studiedVersion && studiedVersion < deck.version ? { studiedVersion, current: deck.version, keepsProgress: true } : null,
      reactionsList: state.reactions
    })
  })

  r.post('/community/decks/:id/favorite', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const idx = state.community.favorites.findIndex((f) => f.userId === req.user.id && f.deckId === deck.id)
    if (idx >= 0) {
      state.community.favorites.splice(idx, 1)
      deck.stats.favorites = Math.max(0, deck.stats.favorites - 1)
      return res.json({ favorited: false })
    }
    state.community.favorites.push({ userId: req.user.id, deckId: deck.id, folderId: req.body?.folderId || null, at: nowIso() })
    deck.stats.favorites += 1
    res.json({ favorited: true, undoWindowMs: 3000 })
  })

  r.post('/community/decks/:id/clone', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const author = state.community.authors.find((a) => a.id === deck.authorId)
    const clone = { id: id('d'), ownerId: req.user.id, name: deck.name, categoryId: deck.categoryId, tags: deck.tags, difficulty: deck.difficulty, lang: deck.lang, difficult: false, focus: false, complementary: false, pinned: false, favorite: false, folderId: null, source: { type: 'clone', document: `Clonado de ${author?.name}`, pages: null }, clonedFrom: { deckId: deck.id, authorId: deck.authorId, authorName: author?.name, version: deck.version }, createdAt: nowIso(), lastStudiedAt: null, publication: { status: 'nao_publicado' } }
    state.decks.push(clone)
    state.community.cards.filter((c) => c.deckId === deck.id).forEach((c, i) => state.cards.push({ id: id('c'), deckId: clone.id, type: c.type, front: c.front, back: c.back, media: c.media, lang: c.lang, origin: { document: `Clone de "${deck.name}" v${deck.version}`, page: null, excerpt: null, model: null, promptVersion: null }, uncertain: false, sched: { state: 'new', stability: 0, difficulty: 5, due: nowIso(), lastReview: null, reps: 0, lapses: 0, consecutiveLapses: 0 }, order: i }))
    deck.stats.clones += 1
    if (author) author.neuronsTotal += 5
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'deck_cloned', target: deck.id, details: { cloneId: clone.id, authorBonus: 5 } })
    res.status(201).json({ deckId: clone.id, credit: { authorName: author?.name, bonus: 5 } })
  })

  r.post('/community/decks/:id/vote', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const detail = withAuthor(state, deck, req.user.id)
    if (!detail.viewer.canVote) return fail(res, 403, 'vote_not_allowed', 'Responda ao menos 30% dos cards ou 20 cards deste deck para votar.', { answered: detail.viewer.answered, total: detail.viewer.total })
    const idx = state.community.votes.findIndex((v) => v.userId === req.user.id && v.deckId === deck.id)
    if (idx >= 0) {
      state.community.votes.splice(idx, 1)
      deck.stats.votes = Math.max(0, deck.stats.votes - 1)
      return res.json({ voted: false, votes: deck.stats.votes })
    }
    state.community.votes.push({ userId: req.user.id, deckId: deck.id, at: nowIso(), weight: 1 })
    deck.stats.votes += 1
    res.json({ voted: true, votes: deck.stats.votes })
  })

  r.post('/community/decks/:id/react', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const { emoji } = req.body || {}
    if (!state.reactions.includes(emoji)) return fail(res, 422, 'validation', 'Reação fora da lista.')
    const idx = state.community.myReactions.findIndex((x) => x.userId === req.user.id && x.deckId === deck.id && x.emoji === emoji)
    if (idx >= 0) {
      state.community.myReactions.splice(idx, 1)
      deck.reactions[emoji] = Math.max(0, (deck.reactions[emoji] || 0) - 1)
    } else {
      state.community.myReactions.push({ userId: req.user.id, deckId: deck.id, emoji })
      deck.reactions[emoji] = (deck.reactions[emoji] || 0) + 1
    }
    res.json({ reactions: deck.reactions, mine: state.community.myReactions.filter((x) => x.userId === req.user.id && x.deckId === deck.id).map((x) => x.emoji) })
  })

  r.post('/community/decks/:id/share', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const gate = guardianGate(state, req.user, 'publicLink', `O aluno quer enviar o deck "${deck.name}" por link externo.`)
    if (gate) return fail(res, 403, gate.code, 'Compartilhar link público depende da liberação do seu responsável.', gate)
    state.community.shares.push({ userId: req.user.id, deckId: deck.id, at: nowIso(), channel: req.body?.channel || 'link' })
    res.json({ url: `/d/${deck.publicId}`, preview: { name: deck.name, authorName: withAuthor(state, deck, req.user.id).author?.name, cardCount: state.community.cards.filter((c) => c.deckId === deck.id).length }, requiresLoginToStudy: true })
  })

  r.post('/community/decks/:id/report', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const { reason, detail } = req.body || {}
    if (!reason) return fail(res, 422, 'validation', 'Escolha um motivo.')
    const report = { id: id('rep'), targetType: 'deck', targetId: deck.id, targetName: deck.name, reason, detail: detail || null, reporter: req.user.id, status: 'aberta', createdAt: nowIso() }
    state.reports.unshift(report)
    res.status(201).json({ report, message: 'Denúncia registrada. Um moderador vai revisar e você recebe o resultado com o motivo.' })
  })

  r.post('/community/decks/:id/translate', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const lang = req.body?.lang || req.user.locale
    const cards = state.community.cards.filter((c) => c.deckId === deck.id).map((c) => ({ id: c.id, translated: c.translation?.[lang] || null }))
    res.json({ lang, from: deck.lang, cards, cached: true, notice: 'Tradução automática cacheada por (conteúdo, idioma). O conteúdo original permanece no idioma do autor.' })
  })

  r.get('/community/decks/:id/comments', requireStudent, (req, res) => {
    const state = req.store.state
    const threads = state.community.comments.filter((c) => c.deckId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({ threads, total: threads.reduce((n, t) => n + 1 + t.replies.length, 0) })
  })

  r.post('/community/decks/:id/comments', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const unverified = requireVerified(req.user)
    if (unverified) return fail(res, 403, unverified.code, 'Confirme e-mail e telefone para comentar.', unverified)
    const gate = guardianGate(state, req.user, 'community', 'O aluno quer comentar em decks da comunidade.')
    if (gate) return fail(res, 403, gate.code, 'Comentar depende da liberação do seu responsável.', gate)
    const { text, parentId } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Escreva algo antes de enviar.')
    const entry = { id: id('cm'), authorName: req.user.name, authorId: req.user.id, text: text.trim(), createdAt: nowIso() }
    if (parentId) {
      const parent = state.community.comments.find((c) => c.id === parentId && c.deckId === deck.id)
      if (!parent) return fail(res, 404, 'not_found', 'Comentário não encontrado.')
      parent.replies.push(entry)
    } else {
      state.community.comments.push({ ...entry, deckId: deck.id, replies: [] })
    }
    deck.stats.comments += 1
    res.status(201).json({ comment: entry, notifiedAuthor: true })
  })

  r.post('/community/comments/:id/report', requireStudent, (req, res) => {
    const state = req.store.state
    const report = { id: id('rep'), targetType: 'comment', targetId: req.params.id, targetName: 'Comentário', reason: req.body?.reason || 'Outro', detail: null, reporter: req.user.id, status: 'auto_analise', createdAt: nowIso() }
    state.reports.unshift(report)
    res.status(201).json({ report, message: 'Comentário enviado para análise automática.' })
  })

  r.get('/community/authors/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const author = state.community.authors.find((a) => a.id === req.params.id)
    if (!author) return fail(res, 404, 'not_found', 'Autor não encontrado.')
    const decks = state.community.decks.filter((d) => d.authorId === author.id).map((d) => withAuthor(state, d, req.user.id))
    res.json({ author: authorPublic(state, author, req.user.id), decks, badgesShown: author.badges.slice(0, 3), badgesTotal: author.badges.length })
  })

  r.post('/community/authors/:id/follow', requireStudent, (req, res) => {
    const state = req.store.state
    const author = state.community.authors.find((a) => a.id === req.params.id)
    if (!author) return fail(res, 404, 'not_found', 'Autor não encontrado.')
    const gate = guardianGate(state, req.user, 'community', `O aluno quer seguir ${author.name}.`)
    if (gate) return fail(res, 403, gate.code, 'Seguir criadores depende da liberação do seu responsável.', gate)
    const idx = state.community.follows.findIndex((f) => f.userId === req.user.id && f.authorId === author.id)
    if (idx >= 0) {
      state.community.follows.splice(idx, 1)
      author.followers = Math.max(0, author.followers - 1)
      return res.json({ following: false, followers: author.followers })
    }
    state.community.follows.push({ userId: req.user.id, authorId: author.id })
    author.followers += 1
    res.json({ following: true, followers: author.followers })
  })

  r.get('/community/rankings', requireStudent, (req, res) => {
    const state = req.store.state
    const decks = state.community.decks.map((d) => withAuthor(state, d, req.user.id))
    res.json({
      week: decks.slice().sort((a, b) => b.stats.studiedWeek - a.stats.studiedWeek).slice(0, 10).map((d, i) => ({ position: i + 1, deckId: d.id, name: d.name, authorName: d.author?.name, studiedWeek: d.stats.studiedWeek, categoryName: categoryName(state, d.categoryId) })),
      creatorOfMonth: state.community.authors.find((a) => a.creatorOfMonth) || null,
      materializedAt: materializedAt()
    })
  })

  r.post('/community/decks/:id/study-start', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.community.decks.find((d) => d.id === req.params.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const cards = state.community.cards.filter((c) => c.deckId === deck.id)
    res.json({ cards, deck: withAuthor(state, deck, req.user.id) })
  })

  return r
}

export { credit }
