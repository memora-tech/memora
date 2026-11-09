import { categoryName, commentPreviewOf } from './helpers.js'
import { id, nowIso } from './ids.js'

export const KINDS = ['resumo', 'mapa', 'noticia', 'quiz', 'linha']
export const KIND_LABELS = { flashcards: 'Flashcards', resumo: 'Resumo', mapa: 'Mapa mental', noticia: 'Post de blog', quiz: 'Quiz', linha: 'Linha do tempo' }
export const EMPTY_REACTIONS = () => ({ '👏': 0, '🔥': 0, '🧠': 0, '💡': 0, '❤️': 0, '😂': 0 })

export const MATERIAL_LIMITS = { titleChars: 140, textChars: 20000, leadChars: 400, tags: 8, sources: 10, mapNodes: 120, mapDepth: 5, labelChars: 120, noteChars: 280, quizQuestions: 40, promptChars: 600, quizOptions: 5, optionChars: 200, explanationChars: 400, timelineEvents: 60, whenChars: 40 }

const clean = (value, max) =>
  String(value ?? '')
    .replace(/\s+$/g, '')
    .slice(0, max)
const oneLine = (value, max) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
const isHttpUrl = (value) => {
  try {
    const u = new URL(String(value))
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export class MaterialInputError extends Error {
  constructor(message) {
    super(message)
    this.code = 'validation'
  }
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map((t) => oneLine(t, 40).toLowerCase()).filter(Boolean))].slice(0, MATERIAL_LIMITS.tags)
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return []
  return sources
    .map((s) => (typeof s === 'string' ? { title: s, url: isHttpUrl(s) ? s : null } : { title: oneLine(s?.title || s?.titulo || s?.url, 160), url: isHttpUrl(s?.url) ? String(s.url) : null }))
    .filter((s) => s.title)
    .slice(0, MATERIAL_LIMITS.sources)
}

function normalizeNode(node, depth, counter) {
  const label = oneLine(node?.label ?? node?.titulo ?? node?.title, MATERIAL_LIMITS.labelChars)
  if (!label) throw new MaterialInputError('Todo nó do mapa mental precisa de um título.')
  counter.count += 1
  if (counter.count > MATERIAL_LIMITS.mapNodes) throw new MaterialInputError(`O mapa mental aceita até ${MATERIAL_LIMITS.mapNodes} nós.`)
  if (depth > MATERIAL_LIMITS.mapDepth) throw new MaterialInputError(`O mapa mental aceita até ${MATERIAL_LIMITS.mapDepth} níveis abaixo do tema central.`)
  const rawChildren = node?.children ?? node?.filhos ?? []
  const note = oneLine(node?.note ?? node?.nota, MATERIAL_LIMITS.noteChars)
  return {
    id: `n${counter.count}`,
    label,
    ...(note ? { note } : {}),
    children: Array.isArray(rawChildren) ? rawChildren.map((c) => normalizeNode(c, depth + 1, counter)) : []
  }
}

function normalizeQuestions(raw) {
  const list = Array.isArray(raw) ? raw : []
  if (!list.length) throw new MaterialInputError('O quiz precisa de pelo menos uma questão.')
  if (list.length > MATERIAL_LIMITS.quizQuestions) throw new MaterialInputError(`O quiz aceita até ${MATERIAL_LIMITS.quizQuestions} questões.`)
  return list.map((q, i) => {
    const prompt = oneLine(q?.prompt ?? q?.enunciado ?? q?.pergunta, MATERIAL_LIMITS.promptChars)
    if (!prompt) throw new MaterialInputError(`A questão ${i + 1} está sem enunciado.`)
    const options = (Array.isArray(q?.options ?? q?.alternativas) ? (q.options ?? q.alternativas) : []).map((o) => oneLine(o, MATERIAL_LIMITS.optionChars)).filter(Boolean)
    if (options.length < 2 || options.length > MATERIAL_LIMITS.quizOptions) throw new MaterialInputError(`A questão ${i + 1} precisa de 2 a ${MATERIAL_LIMITS.quizOptions} alternativas.`)
    const answer = Number(q?.answer ?? q?.correta)
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new MaterialInputError(`Indique a alternativa correta da questão ${i + 1} pelo índice, começando em 0.`)
    const explanation = oneLine(q?.explanation ?? q?.explicacao, MATERIAL_LIMITS.explanationChars)
    return { id: `q${i + 1}`, prompt, options, answer, ...(explanation ? { explanation } : {}) }
  })
}

function normalizeEvents(raw) {
  const list = Array.isArray(raw) ? raw : []
  if (list.length < 2) throw new MaterialInputError('A linha do tempo precisa de pelo menos dois marcos.')
  if (list.length > MATERIAL_LIMITS.timelineEvents) throw new MaterialInputError(`A linha do tempo aceita até ${MATERIAL_LIMITS.timelineEvents} marcos.`)
  return list.map((e, i) => {
    const when = oneLine(e?.when ?? e?.quando ?? e?.data, MATERIAL_LIMITS.whenChars)
    const label = oneLine(e?.label ?? e?.titulo ?? e?.title, MATERIAL_LIMITS.labelChars)
    if (!when || !label) throw new MaterialInputError(`O marco ${i + 1} precisa de quando e de um título.`)
    const note = oneLine(e?.note ?? e?.nota, MATERIAL_LIMITS.noteChars)
    return { id: `e${i + 1}`, when, label, ...(note ? { note } : {}) }
  })
}

export function countNodes(node) {
  return 1 + (node.children || []).reduce((n, c) => n + countNodes(c), 0)
}

export function normalizeMaterialInput(state, kind, input = {}) {
  if (!KINDS.includes(kind)) throw new MaterialInputError('Tipo de conteúdo inválido.')
  const title = oneLine(input.title, MATERIAL_LIMITS.titleChars)
  if (!title) throw new MaterialInputError('Informe um título.')
  const categoryId = state.categories.some((c) => c.id === input.categoryId) ? input.categoryId : 'outros'
  const base = { title, categoryId, tags: normalizeTags(input.tags), lang: input.lang === 'en' ? 'en' : 'pt-BR' }
  if (kind === 'resumo') {
    const markdown = clean(input.text, MATERIAL_LIMITS.textChars)
    if (markdown.trim().length < 40) throw new MaterialInputError('O resumo precisa de pelo menos 40 caracteres de texto.')
    return { ...base, description: oneLine(input.description, MATERIAL_LIMITS.leadChars) || excerptOf(markdown, 180), body: { markdown, sources: normalizeSources(input.sources) } }
  }
  if (kind === 'mapa') {
    if (!input.root) throw new MaterialInputError('Envie o tema central do mapa mental com seus ramos.')
    const counter = { count: 0 }
    const root = normalizeNode(input.root, 0, counter)
    if (!root.children.length) throw new MaterialInputError('O mapa mental precisa de pelo menos um ramo saindo do tema central.')
    const layout = input.layout === 'diagrama' ? 'diagrama' : 'mapa'
    return { ...base, description: oneLine(input.description, MATERIAL_LIMITS.leadChars) || `${root.children.length} ramos a partir de "${root.label}".`, body: { root, layout } }
  }
  if (kind === 'quiz') {
    const questions = normalizeQuestions(input.questions)
    return { ...base, description: oneLine(input.description, MATERIAL_LIMITS.leadChars) || `${questions.length} questões de múltipla escolha com gabarito comentado.`, body: { questions } }
  }
  if (kind === 'linha') {
    const events = normalizeEvents(input.events)
    return { ...base, description: oneLine(input.description, MATERIAL_LIMITS.leadChars) || `${events.length} marcos, de ${events[0].when} a ${events[events.length - 1].when}.`, body: { events } }
  }
  const markdown = clean(input.text, MATERIAL_LIMITS.textChars)
  const lead = oneLine(input.description, MATERIAL_LIMITS.leadChars)
  if (!lead) throw new MaterialInputError('A notícia precisa de uma linha fina (description) com o essencial.')
  if (markdown.trim().length < 40) throw new MaterialInputError('A notícia precisa de pelo menos 40 caracteres de texto.')
  const url = isHttpUrl(input.url) ? String(input.url) : null
  const outlet = oneLine(input.outlet, 80) || (url ? new URL(url).hostname.replace(/^www\./, '') : null)
  return { ...base, description: lead, body: { markdown, url, outlet, sources: normalizeSources(input.sources) } }
}

export function createMaterial(state, { ownerId, kind, data, source, aiGenerated = true }) {
  const material = {
    id: id('m'),
    kind,
    ownerId,
    authorId: ownerId,
    ...data,
    aiGenerated,
    audience: 'comunidade',
    source,
    status: 'privado',
    publicationId: null,
    publishedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    stats: { views: 0, favorites: 0 },
    reactions: EMPTY_REACTIONS()
  }
  state.materials.unshift(material)
  return material
}

export function excerptOf(markdown, max = 220) {
  const plain = String(markdown || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}

export function readingMinutes(material) {
  if (material.kind === 'mapa') return Math.max(1, Math.round(countNodes(material.body.root) / 12))
  if (material.kind === 'quiz') return Math.max(1, Math.round(material.body.questions.length / 2))
  if (material.kind === 'linha') return Math.max(1, Math.round(material.body.events.length / 6))
  const words = String(material.body.markdown || '')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function materialSnapshot(material) {
  if (material.kind === 'mapa') {
    const rows = []
    const walk = (node, path) => {
      node.children.forEach((child) => {
        rows.push({ id: `${material.id}_${child.id}`, front: [...path, child.label].join(' → '), back: child.note || (child.children.length ? `${child.children.length} sub-ramos` : '—') })
        walk(child, [...path, child.label])
      })
    }
    walk(material.body.root, [material.body.root.label])
    return rows
  }
  if (material.kind === 'quiz') return material.body.questions.map((q) => ({ id: `${material.id}_${q.id}`, front: q.prompt, back: [q.options[q.answer], q.explanation].filter(Boolean).join(' · ') }))
  if (material.kind === 'linha') return material.body.events.map((e) => ({ id: `${material.id}_${e.id}`, front: `${e.when}: ${e.label}`, back: e.note || '—' }))
  const sections = []
  let current = { front: material.kind === 'noticia' ? material.description : material.title, lines: [] }
  String(material.body.markdown)
    .split('\n')
    .forEach((line) => {
      const heading = line.match(/^#{1,6}\s+(.*)$/)
      if (heading) {
        if (current.lines.join('').trim()) sections.push(current)
        current = { front: heading[1].trim(), lines: [] }
      } else {
        current.lines.push(line)
      }
    })
  if (current.lines.join('').trim()) sections.push(current)
  const rows = sections.map((s, i) => ({ id: `${material.id}_s${i + 1}`, front: s.front, back: s.lines.join('\n').trim() }))
  if (material.kind === 'noticia') rows.push({ id: `${material.id}_src`, front: 'Fonte original', back: material.body.url || 'Não informada' })
  return rows
}

const VISUAL_KINDS = ['mapa', 'quiz', 'linha']

function previewOf(material) {
  const body = material.body
  if (material.kind === 'mapa') return { root: body.root.label, branches: mapPreview(body.root), nodes: countNodes(body.root), layout: body.layout || 'mapa' }
  if (material.kind === 'quiz') return { questions: body.questions.length, sample: body.questions[0].prompt, options: body.questions[0].options.length }
  if (material.kind === 'linha') return { events: body.events.length, from: body.events[0].when, to: body.events[body.events.length - 1].when, marks: body.events.slice(0, 6).map((e) => ({ when: e.when, label: e.label })) }
  if (material.kind === 'noticia') return { outlet: body.outlet, url: body.url }
  return { sections: (body.markdown.match(/^#{1,6}\s+/gm) || []).length }
}

function mapPreview(root) {
  return root.children.slice(0, 5).map((c) => c.label)
}

export function materialPublic(state, material, viewerId, { full = false } = {}) {
  const author = state.community.authors.find((a) => a.id === material.authorId)
  const owner = state.users.find((u) => u.id === material.ownerId)
  const favorited = state.community.materialFavorites.some((f) => f.userId === viewerId && f.materialId === material.id)
  const myReactions = state.community.materialReactions.filter((r) => r.userId === viewerId && r.materialId === material.id).map((r) => r.emoji)
  const { body, ...rest } = material
  return {
    ...rest,
    categoryName: categoryName(state, material.categoryId),
    kindLabel: KIND_LABELS[material.kind],
    author: author ? { id: author.id, name: author.name, handle: author.handle, badges: author.badges } : owner ? { id: owner.id, name: owner.name, handle: null, badges: [] } : null,
    readingMinutes: readingMinutes(material),
    excerpt: VISUAL_KINDS.includes(material.kind) ? material.description : excerptOf(material.kind === 'noticia' ? material.description : body.markdown),
    preview: previewOf(material),
    isMine: material.ownerId === viewerId,
    remixCount: remixCountOf(state, material.id),
    audience: material.audience || 'comunidade',
    commentCount: materialCommentCount(state, material.id),
    commentPreview: commentPreviewOf(state, (c) => c.materialId === material.id, viewerId),
    viewer: { favorited, myReactions },
    ...(full ? { body } : {})
  }
}

export function remixesOf(state, itemId, viewerId) {
  return state.materials.filter((m) => m.remixOf?.id === itemId && m.status === 'aprovado' && !m.deletedAt && canSeeMaterial(state, m, viewerId)).map((m) => materialPublic(state, m, viewerId))
}

export function remixCountOf(state, itemId) {
  return state.materials.filter((m) => m.remixOf?.id === itemId && m.status === 'aprovado' && !m.deletedAt).length
}

export function resolveRemix(state, viewerId, ref) {
  const key = String(ref || '').trim()
  if (!key) return null
  const deck = state.community.decks.find((d) => d.id === key)
  if (deck) {
    const author = state.community.authors.find((a) => a.id === deck.authorId)
    return { id: deck.id, kind: 'flashcards', title: deck.name, authorId: deck.authorId, authorName: author?.name || null }
  }
  const m = state.materials.find((x) => x.id === key && x.status === 'aprovado' && !x.deletedAt && canSeeMaterial(state, x, viewerId))
  if (!m) return null
  const author = state.community.authors.find((a) => a.id === m.authorId)
  return { id: m.id, kind: m.kind, title: m.title, authorId: m.authorId, authorName: author?.name || null }
}

export const AUDIENCES = ['comunidade', 'seguidores']

export function canSeeMaterial(state, m, viewerId) {
  if (!m || m.deletedAt) return false
  if (m.ownerId === viewerId) return true
  if (m.status !== 'aprovado') return false
  if ((m.audience || 'comunidade') === 'comunidade') return true
  return state.community.follows.some((f) => f.userId === viewerId && f.authorId === m.authorId)
}

export function publishedMaterials(state, viewerId) {
  return state.materials.filter((m) => m.status === 'aprovado' && !m.deletedAt && (viewerId === undefined || canSeeMaterial(state, m, viewerId)))
}

export function materialCommentCount(state, materialId) {
  return state.community.comments.filter((c) => c.materialId === materialId).reduce((n, c) => n + 1 + c.replies.length, 0)
}

export class QuizReviewError extends Error {
  constructor(message) {
    super(message)
    this.code = 'nothing_to_review'
  }
}

export function quizAttemptsOf(state, materialId, userId) {
  return state.community.quizAttempts.filter((a) => a.materialId === materialId && a.userId === userId)
}

export function quizViewer(state, material, userId) {
  const attempts = quizAttemptsOf(state, material.id, userId)
  const last = attempts[attempts.length - 1]
  return {
    best: attempts.length ? Math.max(...attempts.map((a) => a.score)) : null,
    attempts: attempts.length,
    last: last ? { score: last.score, total: last.total, wrong: last.wrong, at: last.at } : null
  }
}

export function gradeQuiz(state, material, userId, rawAnswers) {
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) throw new MaterialInputError('Envie as respostas como { idDaQuestão: índiceDaAlternativa }.')
  const questions = material.body.questions
  const answers = {}
  questions.forEach((q) => {
    const value = rawAnswers[q.id]
    if (Number.isInteger(value) && value >= 0 && value < q.options.length) answers[q.id] = value
  })
  if (!Object.keys(answers).length) throw new MaterialInputError('Responda pelo menos uma questão antes de enviar.')
  const wrong = questions.filter((q) => answers[q.id] !== q.answer).map((q) => q.id)
  const attempt = { id: id('qa'), userId, materialId: material.id, answers, score: questions.length - wrong.length, total: questions.length, wrong, at: nowIso() }
  state.community.quizAttempts.push(attempt)
  const viewer = quizViewer(state, material, userId)
  return { score: attempt.score, total: attempt.total, wrong, best: viewer.best, attempts: viewer.attempts }
}

export function createQuizReviewDeck(state, material, user) {
  const last = quizAttemptsOf(state, material.id, user.id).pop()
  const wrong = last ? material.body.questions.filter((q) => last.wrong.includes(q.id)) : []
  if (!wrong.length) throw new QuizReviewError(last ? 'Você acertou tudo na última tentativa. Não há erradas para revisar.' : 'Responda o quiz antes de revisar as erradas.')
  const document = `Quiz "${material.title}"`
  const deck = {
    id: id('d'),
    ownerId: user.id,
    name: `Revisão: ${material.title}`.slice(0, MATERIAL_LIMITS.titleChars),
    categoryId: material.categoryId,
    tags: material.tags.slice(0, MATERIAL_LIMITS.tags),
    difficulty: 'medio',
    lang: material.lang,
    difficult: false,
    focus: false,
    complementary: false,
    pinned: false,
    favorite: false,
    folderId: null,
    source: { type: 'quiz', document, pages: null, materialId: material.id },
    scheduled: true,
    createdAt: nowIso(),
    lastStudiedAt: null,
    publication: { status: 'nao_publicado' }
  }
  state.decks.push(deck)
  wrong.forEach((q, i) => {
    const back = [q.options[q.answer], q.explanation].filter(Boolean).join(' · ')
    state.cards.push({ id: id('c'), deckId: deck.id, type: 'text', front: q.prompt, back, media: null, lang: material.lang, origin: { document, page: null, excerpt: null, model: null, promptVersion: null }, uncertain: false, sched: { state: 'new', stability: 0, difficulty: 5, due: nowIso(), lastReview: null, reps: 0, lapses: 0, consecutiveLapses: 0 }, order: i })
  })
  return { deckId: deck.id, cards: wrong.length }
}
