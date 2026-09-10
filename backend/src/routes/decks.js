import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, ownDecksOf, cardsOfDeck, deckProgress, categoryName, PLAN_LIMITS, guardianGate, requireVerified, communityDeckPublic } from '../lib/helpers.js'
import { id, nowIso, hoursFromNow } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export const LIMITS = { cardsPerDeck: 2000, folderDepth: 3, decksPerFolder: 500, membersPerFolder: 50, imageKB: 2048, audioSeconds: 60 }

function folderDepth(state, folderId) {
  let depth = 0
  let current = state.folders.find((f) => f.id === folderId)
  while (current) {
    depth += 1
    current = current.parentId ? state.folders.find((f) => f.id === current.parentId) : null
  }
  return depth
}

export function deckSummary(state, deck) {
  return { ...deck, categoryName: categoryName(state, deck.categoryId), progress: deckProgress(state, deck), cardCount: cardsOfDeck(state, deck.id).length }
}

export function deckRoutes() {
  const r = Router()

  r.get('/decks', requireStudent, (req, res) => {
    const state = req.store.state
    const decks = ownDecksOf(state, req.user.id).map((d) => deckSummary(state, d))
    const favorites = state.community.favorites
      .filter((f) => f.userId === req.user.id)
      .map((f) => {
        const deck = state.community.decks.find((d) => d.id === f.deckId)
        return deck ? { ...communityDeckPublic(state, deck, req.user.id), favorite: true, folderId: f.folderId || null, favoritedAt: f.at } : null
      })
      .filter(Boolean)
    const folders = state.folders.filter((f) => f.ownerId === req.user.id).map((f) => ({
      ...f,
      depth: folderDepth(state, f.id),
      deckIds: [...decks.filter((d) => d.folderId === f.id).map((d) => d.id), ...favorites.filter((d) => d.folderId === f.id).map((d) => d.id)]
    }))
    const limits = PLAN_LIMITS[req.user.plan]
    res.json({ decks, favorites, folders, limits: { ...LIMITS, pinLimit: limits.pinLimit, pinned: decks.filter((d) => d.pinned).length }, categories: state.categories })
  })

  r.post('/decks', requireStudent, (req, res) => {
    const state = req.store.state
    const { name, categoryId = 'outros', tags = [], difficulty = 'medio', folderId = null } = req.body || {}
    if (!name?.trim()) return fail(res, 422, 'validation', 'Dê um nome ao deck.')
    const deck = { id: id('d'), ownerId: req.user.id, name: name.trim(), categoryId, tags, difficulty, lang: req.user.locale, difficult: false, focus: false, complementary: false, pinned: false, favorite: false, folderId, source: { type: 'vazio', document: null, pages: null }, createdAt: nowIso(), lastStudiedAt: null, publication: { status: 'nao_publicado' } }
    state.decks.push(deck)
    res.status(201).json({ deck: deckSummary(state, deck) })
  })

  r.get('/decks/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id && !d.deletedAt)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const publication = deck.publication?.publicationId ? state.publications.find((p) => p.id === deck.publication.publicationId) : null
    const folder = deck.folderId ? state.folders.find((f) => f.id === deck.folderId) : null
    res.json({ deck: deckSummary(state, deck), cards: cardsOfDeck(state, deck.id), publication, folder: folder ? { id: folder.id, name: folder.name, shared: folder.shared, members: folder.members } : null, menu: ['difficult', 'focus', 'complementary', 'share_folder', 'export', deck.publication?.status === 'aprovado' ? 'publish_version' : 'publish'] })
  })

  r.patch('/decks/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id && !d.deletedAt)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const body = req.body || {}
    if (typeof body.pinned === 'boolean' && body.pinned && !deck.pinned) {
      const limit = PLAN_LIMITS[req.user.plan].pinLimit
      const pinned = ownDecksOf(state, req.user.id).filter((d) => d.pinned).length
      if (pinned >= limit) return fail(res, 409, 'pin_limit', `Você pode fixar até ${limit} decks extras para offline.`, { limit, plan: req.user.plan })
    }
    for (const key of ['difficult', 'focus', 'complementary', 'pinned']) if (typeof body[key] === 'boolean') deck[key] = body[key]
    if (body.name?.trim()) deck.name = body.name.trim()
    if (body.categoryId) deck.categoryId = body.categoryId
    if (Array.isArray(body.tags)) deck.tags = body.tags
    if (body.difficulty) deck.difficulty = body.difficulty
    if ('folderId' in body) deck.folderId = body.folderId
    res.json({ deck: deckSummary(state, deck) })
  })

  r.delete('/decks/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    deck.deletedAt = nowIso()
    res.json({ ok: true })
  })

  r.patch('/decks/:id/cards/:cardId', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id)
    const card = state.cards.find((c) => c.id === req.params.cardId && c.deckId === req.params.id)
    if (!deck || !card) return fail(res, 404, 'not_found', 'Card não encontrado.')
    const { front, back } = req.body || {}
    if (typeof front === 'string') card.front = front
    if (typeof back === 'string') card.back = back
    card.editedAt = nowIso()
    card.uncertain = false
    res.json({ card })
  })

  r.delete('/decks/:id/cards/:cardId', requireStudent, (req, res) => {
    const state = req.store.state
    const card = state.cards.find((c) => c.id === req.params.cardId && c.deckId === req.params.id)
    if (!card) return fail(res, 404, 'not_found', 'Card não encontrado.')
    card.deletedAt = nowIso()
    res.json({ ok: true })
  })

  r.post('/decks/:id/cards', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    if (cardsOfDeck(state, deck.id).length >= LIMITS.cardsPerDeck) return fail(res, 409, 'deck_limit', 'Um deck aceita até 2.000 cards.')
    const { front, back, type = 'text', media = null } = req.body || {}
    if (!front || !back) return fail(res, 422, 'validation', 'Frente e verso são obrigatórios.')
    if (media?.kind === 'image' && media.sizeKB > LIMITS.imageKB) return fail(res, 422, 'media_limit', 'Imagem até 2 MB por card.')
    if (media?.kind === 'audio' && media.durationSec > LIMITS.audioSeconds) return fail(res, 422, 'media_limit', 'Áudio até 60 s por card.')
    const card = { id: id('c'), deckId: deck.id, type, front, back, media, lang: deck.lang, origin: { document: 'Criado manualmente', page: null, excerpt: null, model: null, promptVersion: null }, uncertain: false, sched: { state: 'new', stability: 0, difficulty: 5, due: nowIso(), lastReview: null, reps: 0, lapses: 0, consecutiveLapses: 0 } }
    state.cards.push(card)
    res.status(201).json({ card })
  })

  r.post('/decks/:id/publish', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id && !d.deletedAt)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    if (req.user.deactivatedAt) return fail(res, 403, 'account_deactivated', 'Conta desativada: reative para publicar.')
    const unverified = requireVerified(req.user)
    if (unverified) return fail(res, 403, unverified.code, 'Confirme e-mail e telefone antes de publicar.', unverified)
    const gate = guardianGate(state, req.user, 'community', `O aluno quer publicar o deck "${deck.name}" na comunidade.`)
    if (gate) return fail(res, 403, gate.code, 'Publicar na comunidade depende da liberação do seu responsável.', gate)
    const consents = state.consents[req.user.id]
    const policyVersion = state.admin.policy.version
    if (consents.contentPolicyAcceptedVersion !== policyVersion) {
      if (!req.body?.acceptPolicy) return fail(res, 428, 'policy_acceptance_required', 'Aceite a política de conteúdo para publicar (só na primeira vez).', { policyVersion, policy: state.admin.policy })
      consents.contentPolicyAcceptedVersion = policyVersion
    }
    const cards = cardsOfDeck(state, deck.id)
    if (cards.length === 0) return fail(res, 422, 'empty_deck', 'Um deck vazio não pode ser publicado.')
    const priorCount = state.publications.filter((p) => p.authorId === req.user.id).length
    const version = deck.publication?.status === 'aprovado' ? (deck.publication.version || 1) + 1 : 1
    const limits = PLAN_LIMITS[req.user.plan]
    const risk = { score: 14 + (cards.some((c) => c.type === 'image' && !c.media?.alt) ? 6 : 0), level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente', `Completude ${Math.round((cards.filter((c) => c.front && c.back).length / cards.length) * 100)}%`] }
    const publication = {
      id: id('pub'),
      deckId: deck.id,
      authorId: req.user.id,
      authorName: req.user.name,
      deckName: deck.name,
      version,
      status: 'em_triagem',
      plan: req.user.plan,
      submittedAt: nowIso(),
      decidedAt: null,
      slaHours: limits.slaHours,
      risk,
      reviewType: priorCount < 5 || risk.level === 'alto' ? 'integral' : 'amostral',
      reviewReason: risk.level === 'alto' ? 'Risco alto' : priorCount < 5 ? 'Primeiros 5 decks do autor' : 'Autor com histórico limpo',
      assignedTo: null,
      decision: null,
      publicId: deck.publication?.publicId || null,
      categoryId: deck.categoryId,
      difficulty: deck.difficulty,
      cardCount: cards.length,
      snapshot: cards.map(({ sched: _s, ...c }) => c)
    }
    state.publications.unshift(publication)
    deck.publication = { ...(deck.publication || {}), status: version > 1 ? 'aprovado' : 'em_triagem', pendingVersion: version > 1 ? version : null, publicationId: publication.id, version: deck.publication?.version || null }
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'publication_submitted', target: publication.id, details: { deckId: deck.id, version } })
    res.status(201).json({ publication, deck: deckSummary(state, deck), sla: { hours: limits.slaHours, dueAt: hoursFromNow(limits.slaHours) } })
  })

  r.post('/publications/:id/appeal', requireStudent, (req, res) => {
    const state = req.store.state
    const pub = state.publications.find((p) => p.id === req.params.id && p.authorId === req.user.id)
    if (!pub) return fail(res, 404, 'not_found', 'Publicação não encontrada.')
    if (pub.status !== 'rejeitado') return fail(res, 409, 'not_rejected', 'Só publicações rejeitadas podem ser contestadas.')
    if (pub.decision?.appealDeadline && new Date(pub.decision.appealDeadline).getTime() < Date.now()) return fail(res, 409, 'appeal_window_closed', 'O prazo de 30 dias para contestar terminou.')
    if (state.appeals.some((a) => a.publicationId === pub.id && a.status === 'em_analise')) return fail(res, 409, 'appeal_exists', 'Já existe uma contestação em análise.')
    const { text } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Explique por que discorda da decisão.')
    const reviewers = state.admin.users.filter((u) => u.role === 'moderador' && u.id !== pub.decision?.by)
    const appeal = { id: id('ap'), publicationId: pub.id, authorName: req.user.name, filedAt: nowIso(), deadline: pub.decision?.appealDeadline || hoursFromNow(24 * 30), text: text.trim(), status: 'em_analise', reviewer: reviewers[0]?.id || null, originalReviewer: pub.decision?.by || null }
    state.appeals.unshift(appeal)
    pub.appealId = appeal.id
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'appeal_filed', target: pub.id, details: { appealId: appeal.id } })
    res.status(201).json({ appeal })
  })

  r.post('/decks/:id/export', requireStudent, (req, res) => {
    const state = req.store.state
    const deck = state.decks.find((d) => d.id === req.params.id && d.ownerId === req.user.id)
    if (!deck) return fail(res, 404, 'not_found', 'Deck não encontrado.')
    const format = req.body?.format === 'txt' ? 'txt' : 'pdf'
    const lines = cardsOfDeck(state, deck.id).map((c, i) => `${i + 1}. ${c.front}\n   ${c.back}`)
    const text = `Memora · ${deck.name}\n${categoryName(state, deck.categoryId)} · ${lines.length} cards\n\n${lines.join('\n\n')}`
    const fileName = `${deck.name.replace(/[^\w\dÀ-ÿ-]+/g, '_')}.txt`
    res.json({ fileName, format, url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`, cards: lines.length, note: format === 'pdf' ? 'No protótipo, o PDF é entregue como texto.' : null })
  })

  r.post('/folders', requireStudent, (req, res) => {
    const state = req.store.state
    const { name, parentId = null } = req.body || {}
    if (!name?.trim()) return fail(res, 422, 'validation', 'Dê um nome à pasta.')
    if (parentId && folderDepth(state, parentId) >= LIMITS.folderDepth) return fail(res, 409, 'folder_depth', 'Pastas têm no máximo 3 níveis.')
    const folder = { id: id('f'), ownerId: req.user.id, name: name.trim(), parentId, createdAt: nowIso(), shared: false, members: [] }
    state.folders.push(folder)
    res.status(201).json({ folder })
  })

  r.patch('/folders/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const folder = state.folders.find((f) => f.id === req.params.id && f.ownerId === req.user.id)
    if (!folder) return fail(res, 404, 'not_found', 'Pasta não encontrada.')
    if (req.body?.name?.trim()) folder.name = req.body.name.trim()
    res.json({ folder })
  })

  r.post('/folders/:id/members', requireStudent, (req, res) => {
    const state = req.store.state
    const folder = state.folders.find((f) => f.id === req.params.id && f.ownerId === req.user.id)
    if (!folder) return fail(res, 404, 'not_found', 'Pasta não encontrada.')
    const { name, contact } = req.body || {}
    if (!contact?.trim()) return fail(res, 422, 'validation', 'Informe e-mail ou telefone.')
    if (folder.members.length >= LIMITS.membersPerFolder) return fail(res, 409, 'members_limit', 'Uma pasta compartilhada aceita até 50 membros.')
    const gate = guardianGate(state, req.user, 'externalMembers', `O aluno quer adicionar ${contact} à pasta "${folder.name}".`)
    if (gate) return fail(res, 403, gate.code, 'Adicionar membros depende da liberação do seu responsável.', gate)
    const member = { id: id('m'), name: name?.trim() || contact.trim(), contact: contact.trim(), role: 'membro', since: nowIso() }
    folder.members.push(member)
    folder.shared = true
    res.status(201).json({ folder })
  })

  r.delete('/folders/:id/members/:memberId', requireStudent, (req, res) => {
    const state = req.store.state
    const folder = state.folders.find((f) => f.id === req.params.id && f.ownerId === req.user.id)
    if (!folder) return fail(res, 404, 'not_found', 'Pasta não encontrada.')
    folder.members = folder.members.filter((m) => m.id !== req.params.memberId)
    folder.shared = folder.members.length > 0
    res.json({ folder })
  })

  return r
}
