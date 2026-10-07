import { categoryName } from './helpers.js'
import { id, nowIso } from './ids.js'

export const KINDS = ['resumo', 'mapa', 'noticia']
export const KIND_LABELS = { flashcards: 'Flashcards', resumo: 'Resumo', mapa: 'Mapa mental', noticia: 'Post de blog' }
export const EMPTY_REACTIONS = () => ({ '👏': 0, '🔥': 0, '🧠': 0, '💡': 0, '❤️': 0, '😂': 0 })

export const MATERIAL_LIMITS = { titleChars: 140, textChars: 20000, leadChars: 400, tags: 8, sources: 10, mapNodes: 120, mapDepth: 5, labelChars: 120, noteChars: 280 }

const clean = (value, max) => String(value ?? '').replace(/\s+$/g, '').slice(0, max)
const oneLine = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
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
    return { ...base, description: oneLine(input.description, MATERIAL_LIMITS.leadChars) || `${root.children.length} ramos a partir de "${root.label}".`, body: { root } }
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
  const words = String(material.body.markdown || '').split(/\s+/).filter(Boolean).length
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
  const sections = []
  let current = { front: material.kind === 'noticia' ? material.description : material.title, lines: [] }
  String(material.body.markdown).split('\n').forEach((line) => {
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
    excerpt: material.kind === 'mapa' ? material.description : excerptOf(material.kind === 'noticia' ? material.description : body.markdown),
    preview: material.kind === 'mapa' ? { root: body.root.label, branches: mapPreview(body.root), nodes: countNodes(body.root) } : material.kind === 'noticia' ? { outlet: body.outlet, url: body.url } : { sections: (body.markdown.match(/^#{1,6}\s+/gm) || []).length },
    isMine: material.ownerId === viewerId,
    audience: material.audience || 'comunidade',
    commentCount: materialCommentCount(state, material.id),
    viewer: { favorited, myReactions },
    ...(full ? { body } : {})
  }
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
