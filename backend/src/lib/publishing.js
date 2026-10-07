import { PLAN_LIMITS, guardianGate, requireVerified, cardsOfDeck, categoryName } from './helpers.js'
import { balanceOf } from './ledger.js'
import { id, nowIso, hoursFromNow } from './ids.js'
import { appendAudit } from './audit.js'
import { materialSnapshot, KIND_LABELS } from './materials.js'

const refusal = (status, code, message, extra = {}) => ({ error: { status, code, message, extra } })

export function publishPreconditions(state, user, { what, acceptPolicy }) {
  if (user.deactivatedAt) return refusal(403, 'account_deactivated', 'Conta desativada: reative para publicar.')
  const unverified = requireVerified(user)
  if (unverified) return refusal(403, unverified.code, 'Confirme e-mail e telefone antes de publicar.', unverified)
  const gate = guardianGate(state, user, 'community', `O aluno quer publicar ${what} na comunidade.`)
  if (gate) return refusal(403, gate.code, 'Publicar na comunidade depende da liberação do seu responsável.', gate)
  const consents = state.consents[user.id]
  const policyVersion = state.admin.policy.version
  if (consents.contentPolicyAcceptedVersion !== policyVersion) {
    if (!acceptPolicy) return refusal(428, 'policy_acceptance_required', 'Aceite a política de conteúdo para publicar (só na primeira vez).', { policyVersion, policy: state.admin.policy })
    consents.contentPolicyAcceptedVersion = policyVersion
  }
  return null
}

function reviewFor(state, userId, risk) {
  const priorCount = state.publications.filter((p) => p.authorId === userId).length
  return {
    reviewType: priorCount < 5 || risk.level === 'alto' ? 'integral' : 'amostral',
    reviewReason: risk.level === 'alto' ? 'Risco alto' : priorCount < 5 ? 'Primeiros 5 decks do autor' : 'Autor com histórico limpo'
  }
}

export function submitDeckPublication(state, user, deck, { acceptPolicy } = {}) {
  const blocked = publishPreconditions(state, user, { what: `o deck "${deck.name}"`, acceptPolicy })
  if (blocked) return blocked
  const cards = cardsOfDeck(state, deck.id)
  if (cards.length === 0) return refusal(422, 'empty_deck', 'Um deck vazio não pode ser publicado.')
  const version = deck.publication?.status === 'aprovado' ? (deck.publication.version || 1) + 1 : 1
  const limits = PLAN_LIMITS[user.plan]
  const risk = { score: 14 + (cards.some((c) => c.type === 'image' && !c.media?.alt) ? 6 : 0), level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente', `Completude ${Math.round((cards.filter((c) => c.front && c.back).length / cards.length) * 100)}%`] }
  const publication = {
    id: id('pub'),
    kind: 'deck',
    deckId: deck.id,
    authorId: user.id,
    authorName: user.name,
    deckName: deck.name,
    version,
    status: 'em_triagem',
    plan: user.plan,
    submittedAt: nowIso(),
    decidedAt: null,
    slaHours: limits.slaHours,
    risk,
    ...reviewFor(state, user.id, risk),
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
  appendAudit(state, { actor: user.id, actorRole: 'student', action: 'publication_submitted', target: publication.id, details: { deckId: deck.id, version } })
  return { publication, sla: { hours: limits.slaHours, dueAt: hoursFromNow(limits.slaHours) } }
}

export function submitMaterialPublication(state, user, material, { acceptPolicy } = {}) {
  if (material.status === 'em_triagem') return refusal(409, 'already_submitted', 'Este conteúdo já está na fila de moderação.')
  if (material.status === 'aprovado') return refusal(409, 'already_published', 'Este conteúdo já está publicado.')
  const blocked = publishPreconditions(state, user, { what: `o ${KIND_LABELS[material.kind].toLowerCase()} "${material.title}"`, acceptPolicy })
  if (blocked) return blocked
  const limits = PLAN_LIMITS[user.plan]
  const snapshot = materialSnapshot(material)
  const risk = { score: material.kind === 'noticia' && !material.body.url ? 34 : 12, level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente', material.kind === 'noticia' && !material.body.url ? 'Notícia sem link da fonte original' : 'Fonte informada', 'Gerado por IA'] }
  const publication = {
    id: id('pub'),
    kind: 'material',
    materialKind: material.kind,
    materialId: material.id,
    deckId: null,
    authorId: user.id,
    authorName: user.name,
    deckName: material.title,
    version: 1,
    status: 'em_triagem',
    plan: user.plan,
    submittedAt: nowIso(),
    decidedAt: null,
    slaHours: limits.slaHours,
    risk,
    ...reviewFor(state, user.id, risk),
    assignedTo: null,
    decision: null,
    publicId: null,
    categoryId: material.categoryId,
    difficulty: null,
    cardCount: snapshot.length,
    snapshot
  }
  state.publications.unshift(publication)
  material.status = 'em_triagem'
  material.publicationId = publication.id
  material.updatedAt = nowIso()
  appendAudit(state, { actor: user.id, actorRole: 'student', action: 'publication_submitted', target: publication.id, details: { materialId: material.id, kind: material.kind } })
  return { publication, sla: { hours: limits.slaHours, dueAt: hoursFromNow(limits.slaHours) } }
}

export function ensureCommunityAuthor(state, pub) {
  let author = state.community.authors.find((a) => a.id === pub.authorId)
  if (author) return author
  const authorUser = state.users.find((u) => u.id === pub.authorId)
  author = { id: pub.authorId, name: pub.authorName, handle: pub.authorName.toLowerCase().replace(/\s+/g, '.'), topic: categoryName(state, pub.categoryId), level: authorUser?.publicProfile?.level || 1, points: authorUser?.publicProfile?.points || 0, badges: [], neuronsTotal: authorUser ? balanceOf(state, authorUser.id) : 0, decksCount: 0, followers: 0, bio: '', lang: 'pt-BR' }
  state.community.authors.push(author)
  return author
}

export function shareMaterialWithFollowers(state, user, material, { acceptPolicy } = {}) {
  if (material.status === 'em_triagem') return refusal(409, 'already_submitted', 'Este conteúdo já está na fila de moderação.')
  const blocked = publishPreconditions(state, user, { what: `o ${KIND_LABELS[material.kind].toLowerCase()} "${material.title}" com seus seguidores`, acceptPolicy })
  if (blocked) return blocked
  ensureCommunityAuthor(state, { authorId: user.id, authorName: user.name, categoryId: material.categoryId })
  material.status = 'aprovado'
  material.audience = 'seguidores'
  material.publishedAt = nowIso()
  material.updatedAt = nowIso()
  appendAudit(state, { actor: user.id, actorRole: 'student', action: 'material_shared_followers', target: material.id, details: { kind: material.kind } })
  return { material }
}
