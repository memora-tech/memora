import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, guardianGate, requireVerified, categoryName, ownDecksOf, cardsOfDeck } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'
import { AUDIENCES, MaterialInputError, canSeeMaterial, createMaterial, materialPublic, normalizeMaterialInput } from '../lib/materials.js'
import { shareMaterialWithFollowers, submitMaterialPublication } from '../lib/publishing.js'

function findVisible(state, materialId, viewerId) {
  const m = state.materials.find((x) => x.id === materialId)
  return canSeeMaterial(state, m, viewerId) ? m : null
}

function findOwn(state, materialId, userId) {
  return state.materials.find((x) => x.id === materialId && x.ownerId === userId && !x.deletedAt) || null
}

const BLOG_FIELDS = (body) => ({ title: body.title, categoryId: body.categoryId, tags: body.tags, lang: body.lang, description: body.description, text: body.text, url: body.url, outlet: body.outlet, sources: body.sources })

export function materialRoutes() {
  const r = Router()

  r.get('/community/materials/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    if (m.status === 'aprovado' && m.ownerId !== req.user.id) m.stats.views += 1
    const publication = m.publicationId ? state.publications.find((p) => p.id === m.publicationId) : null
    const related = state.materials
      .filter((x) => x.id !== m.id && canSeeMaterial(state, x, req.user.id) && x.status === 'aprovado' && (x.categoryId === m.categoryId || x.tags.some((t) => m.tags.includes(t))))
      .slice(0, 3)
      .map((x) => materialPublic(state, x, req.user.id))
    res.json({
      material: materialPublic(state, m, req.user.id, { full: true }),
      reactionsList: state.reactions,
      related,
      moderation: m.ownerId === req.user.id && publication ? { status: publication.status, decision: publication.decision ? { reasonCategory: publication.decision.reasonCategory, excerpt: publication.decision.excerpt } : null, slaHours: publication.slaHours, submittedAt: publication.submittedAt } : null,
      notice: m.aiGenerated ? 'Conteúdo gerado com IA e revisado pela moderação antes de entrar na comunidade. Confira as fontes antes de usar em prova.' : null
    })
  })

  r.post('/community/materials/:id/favorite', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const list = state.community.materialFavorites
    const idx = list.findIndex((f) => f.userId === req.user.id && f.materialId === m.id)
    if (idx >= 0) {
      list.splice(idx, 1)
      m.stats.favorites = Math.max(0, m.stats.favorites - 1)
      return res.json({ favorited: false, favorites: m.stats.favorites })
    }
    list.push({ userId: req.user.id, materialId: m.id, at: nowIso() })
    m.stats.favorites += 1
    res.json({ favorited: true, favorites: m.stats.favorites })
  })

  r.post('/community/materials/:id/react', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const { emoji } = req.body || {}
    if (!state.reactions.includes(emoji)) return fail(res, 422, 'validation', 'Reação fora da lista.')
    const list = state.community.materialReactions
    const idx = list.findIndex((x) => x.userId === req.user.id && x.materialId === m.id && x.emoji === emoji)
    if (idx >= 0) {
      list.splice(idx, 1)
      m.reactions[emoji] = Math.max(0, (m.reactions[emoji] || 0) - 1)
    } else {
      list.push({ userId: req.user.id, materialId: m.id, emoji })
      m.reactions[emoji] = (m.reactions[emoji] || 0) + 1
    }
    res.json({ reactions: m.reactions, mine: list.filter((x) => x.userId === req.user.id && x.materialId === m.id).map((x) => x.emoji) })
  })

  r.post('/community/materials/:id/report', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const { reason, detail } = req.body || {}
    if (!reason) return fail(res, 422, 'validation', 'Escolha um motivo.')
    const report = { id: id('rep'), targetType: 'material', targetId: m.id, targetName: m.title, reason, detail: detail || null, reporter: req.user.id, status: 'aberta', createdAt: nowIso() }
    state.reports.unshift(report)
    res.status(201).json({ report, message: 'Denúncia registrada. Um moderador vai revisar e você recebe o resultado com o motivo.' })
  })

  r.get('/community/materials/:id/comments', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const threads = state.community.comments.filter((c) => c.materialId === m.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({ threads, total: threads.reduce((n, t) => n + 1 + t.replies.length, 0) })
  })

  r.post('/community/materials/:id/comments', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findVisible(state, req.params.id, req.user.id)
    if (!m || m.status !== 'aprovado') return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const unverified = requireVerified(req.user)
    if (unverified) return fail(res, 403, unverified.code, 'Confirme e-mail e telefone para comentar.', unverified)
    const gate = guardianGate(state, req.user, 'community', 'O aluno quer comentar em conteúdos da comunidade.')
    if (gate) return fail(res, 403, gate.code, 'Comentar depende da liberação do seu responsável.', gate)
    const { text, parentId } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Escreva algo antes de enviar.')
    const entry = { id: id('cm'), authorName: req.user.name, authorId: req.user.id, text: text.trim().slice(0, 2000), createdAt: nowIso() }
    if (parentId) {
      const parent = state.community.comments.find((c) => c.id === parentId && c.materialId === m.id)
      if (!parent) return fail(res, 404, 'not_found', 'Comentário não encontrado.')
      parent.replies.push(entry)
    } else {
      state.community.comments.push({ ...entry, deckId: null, materialId: m.id, replies: [] })
    }
    res.status(201).json({ comment: entry, notifiedAuthor: m.ownerId !== req.user.id })
  })

  r.get('/me/materials', requireStudent, (req, res) => {
    const state = req.store.state
    const items = state.materials.filter((m) => m.ownerId === req.user.id && !m.deletedAt).map((m) => materialPublic(state, m, req.user.id))
    res.json({ items, total: items.length })
  })

  r.post('/me/materials', requireStudent, (req, res) => {
    const state = req.store.state
    const kind = req.body?.kind || 'noticia'
    if (kind !== 'noticia') return fail(res, 422, 'validation', 'No app você escreve posts de blog. Resumos e mapas chegam pela sua IA.')
    let data
    try {
      data = normalizeMaterialInput(state, kind, BLOG_FIELDS(req.body || {}))
    } catch (err) {
      if (err instanceof MaterialInputError) return fail(res, 422, 'validation', err.message)
      throw err
    }
    const material = createMaterial(state, { ownerId: req.user.id, kind, data, source: { channel: 'app', client: null }, aiGenerated: false })
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'blog_post_created', target: material.id, details: {} })
    res.status(201).json({ material: materialPublic(state, material, req.user.id, { full: true }) })
  })

  r.patch('/me/materials/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findOwn(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    if (m.kind !== 'noticia') return fail(res, 422, 'validation', 'Só posts de blog podem ser editados no app.')
    if (m.status === 'em_triagem') return fail(res, 409, 'in_review', 'O post está em moderação. Espere a decisão para editar.')
    const current = { title: m.title, categoryId: m.categoryId, tags: m.tags, lang: m.lang, description: m.description, text: m.body.markdown, url: m.body.url, outlet: m.body.outlet, sources: m.body.sources }
    let data
    try {
      data = normalizeMaterialInput(state, m.kind, { ...current, ...BLOG_FIELDS({ ...current, ...(req.body || {}) }) })
    } catch (err) {
      if (err instanceof MaterialInputError) return fail(res, 422, 'validation', err.message)
      throw err
    }
    Object.assign(m, data, { updatedAt: nowIso() })
    if (m.status === 'aprovado' && m.audience === 'comunidade') {
      m.status = 'privado'
      m.publishedAt = null
    }
    res.json({ material: materialPublic(state, m, req.user.id, { full: true }) })
  })

  r.post('/me/materials/:id/publish', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findOwn(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    const audience = AUDIENCES.includes(req.body?.audience) ? req.body.audience : 'comunidade'
    if (audience === 'seguidores') {
      const result = shareMaterialWithFollowers(state, req.user, m, { acceptPolicy: req.body?.acceptPolicy })
      if (result.error) return fail(res, result.error.status, result.error.code, result.error.message, result.error.extra)
      return res.status(201).json({ material: materialPublic(state, m, req.user.id), audience, sla: null })
    }
    m.audience = 'comunidade'
    const result = submitMaterialPublication(state, req.user, m, { acceptPolicy: req.body?.acceptPolicy })
    if (result.error) return fail(res, result.error.status, result.error.code, result.error.message, result.error.extra)
    res.status(201).json({ material: materialPublic(state, m, req.user.id), audience, publication: { ...result.publication, snapshot: undefined }, sla: result.sla })
  })

  r.post('/me/materials/:id/unpublish', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findOwn(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    if (m.status !== 'aprovado') return fail(res, 409, 'not_published', 'Este conteúdo não está publicado.')
    m.status = 'privado'
    m.publishedAt = null
    m.updatedAt = nowIso()
    res.json({ material: materialPublic(state, m, req.user.id) })
  })

  r.delete('/me/materials/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const m = findOwn(state, req.params.id, req.user.id)
    if (!m) return fail(res, 404, 'not_found', 'Conteúdo não encontrado.')
    m.deletedAt = nowIso()
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'material_deleted', target: m.id, details: { kind: m.kind } })
    res.json({ ok: true })
  })

  r.get('/me/publications', requireStudent, (req, res) => {
    const state = req.store.state
    const materials = state.materials.filter((m) => m.ownerId === req.user.id && !m.deletedAt).map((m) => materialPublic(state, m, req.user.id))
    const communityDeckFor = (deck) => state.community.decks.find((c) => c.publicId && c.publicId === deck.publication?.publicId)
    const decks = ownDecksOf(state, req.user.id).map((d) => {
      const community = communityDeckFor(d)
      return {
        kind: 'flashcards',
        id: d.id,
        title: d.name,
        categoryId: d.categoryId,
        categoryName: categoryName(state, d.categoryId),
        status: d.publication?.status === 'aprovado' ? 'aprovado' : d.publication?.status === 'em_triagem' || d.publication?.status === 'em_revisao' ? 'em_triagem' : d.publication?.status === 'rejeitado' ? 'rejeitado' : 'privado',
        audience: 'comunidade',
        createdAt: d.createdAt,
        publishedAt: community?.publishedAt || null,
        cardCount: cardsOfDeck(state, d.id).length,
        communityId: community?.id || null,
        stats: community ? { studiedWeek: community.stats.studiedWeek, votes: community.stats.votes, favorites: community.stats.favorites } : null
      }
    })
    const followers = state.community.authors.find((a) => a.id === req.user.id)?.followers || 0
    const items = [...materials, ...decks].sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt))
    res.json({ items, followers })
  })

  return r
}
