import { Router } from 'express'
import { fail, categoryName } from '../lib/helpers.js'

export function publicRoutes() {
  const r = Router()

  r.get('/public/decks/:publicId', (req, res) => {
    const state = req.store.state
    const community = state.community.decks.find((d) => d.publicId === req.params.publicId)
    if (community) {
      const author = state.community.authors.find((a) => a.id === community.authorId)
      const cards = state.community.cards.filter((c) => c.deckId === community.id)
      return res.json({ preview: { id: community.id, kind: 'community', name: community.name, authorName: author?.name, categoryName: categoryName(state, community.categoryId), difficulty: community.difficulty, cardCount: cards.length, sample: cards.slice(0, 3).map((c) => c.front), version: community.version, lang: community.lang }, requiresLogin: true })
    }
    const publication = state.publications.find((p) => p.publicId === req.params.publicId && p.status === 'aprovado')
    if (publication) {
      return res.json({ preview: { id: publication.deckId, kind: 'published', name: publication.deckName, authorName: publication.authorName, categoryName: categoryName(state, publication.categoryId), difficulty: publication.difficulty, cardCount: publication.cardCount, sample: (publication.snapshot || []).slice(0, 3).map((c) => c.front), version: publication.version, lang: 'pt-BR' }, requiresLogin: true })
    }
    return fail(res, 404, 'not_found', 'Este link não aponta para um deck público.')
  })

  r.get('/public/content-policy', (req, res) => {
    res.json({ policy: req.store.state.admin.policy })
  })

  return r
}
