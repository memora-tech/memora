import { id, nowIso } from './ids.js'
import { appendAudit } from './audit.js'
import { categoryName, communityDeckPublic } from './helpers.js'
import { KINDS, KIND_LABELS, MATERIAL_LIMITS, MaterialInputError, createMaterial, materialPublic, normalizeMaterialInput, publishedMaterials, countNodes } from './materials.js'
import { submitDeckPublication, submitMaterialPublication } from './publishing.js'

export const MCP_LIMITS = { writesPerDay: 50, cardsPerCall: 200, cardChars: 1000, activeConnections: 5 }

export const appUrl = () => (process.env.MEMORA_APP_URL || 'http://localhost:5180').replace(/\/$/, '')

const CATEGORY_HINT = 'Id da categoria: vestibular, concursos, superior, idiomas, medio, certificacoes ou outros. Use listar_categorias se tiver dúvida.'

const commonProps = {
  titulo: { type: 'string', description: 'Título curto e específico.', maxLength: MATERIAL_LIMITS.titleChars },
  categoria: { type: 'string', description: CATEGORY_HINT },
  tags: { type: 'array', items: { type: 'string' }, maxItems: MATERIAL_LIMITS.tags, description: 'Até 8 palavras-chave em minúsculas.' },
  idioma: { type: 'string', enum: ['pt-BR', 'en'], description: 'Idioma do conteúdo. Padrão pt-BR.' },
  publicar: { type: 'boolean', description: 'true envia para a moderação da comunidade; false (padrão) guarda só na conta do aluno. Só use true se o aluno pedir para compartilhar.' }
}

const sourcesProp = {
  type: 'array',
  maxItems: MATERIAL_LIMITS.sources,
  description: 'Fontes consultadas. Prefira fontes primárias.',
  items: { type: 'object', properties: { titulo: { type: 'string' }, url: { type: 'string', description: 'http(s)' } }, required: ['titulo'] }
}

const TOOLS = [
  {
    name: 'salvar_flashcards',
    title: 'Salvar flashcards no Memora',
    description: 'Guarda um deck de flashcards criado nesta conversa na biblioteca do aluno no Memora, pronto para estudo com repetição espaçada. Cada card deve ter uma única ideia: pergunta curta na frente, resposta objetiva no verso.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        ...commonProps,
        dificuldade: { type: 'string', enum: ['facil', 'medio', 'dificil'] },
        cards: {
          type: 'array',
          minItems: 1,
          maxItems: MCP_LIMITS.cardsPerCall,
          items: { type: 'object', properties: { frente: { type: 'string' }, verso: { type: 'string' } }, required: ['frente', 'verso'] }
        }
      },
      required: ['titulo', 'cards']
    }
  },
  {
    name: 'salvar_resumo',
    title: 'Salvar resumo no Memora',
    description: 'Guarda um resumo de estudo em Markdown (## para seções, listas com -, **negrito** para termos-chave). Use para sínteses de capítulo, aula ou tema.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        ...commonProps,
        descricao: { type: 'string', description: 'Uma frase dizendo o que o resumo cobre.', maxLength: MATERIAL_LIMITS.leadChars },
        texto: { type: 'string', description: 'Corpo do resumo em Markdown.', maxLength: MATERIAL_LIMITS.textChars },
        fontes: sourcesProp
      },
      required: ['titulo', 'texto']
    }
  },
  {
    name: 'salvar_mapa_mental',
    title: 'Salvar mapa mental no Memora',
    description: `Guarda um mapa mental como árvore: um tema central com ramos e sub-ramos (até ${MATERIAL_LIMITS.mapDepth} níveis e ${MATERIAL_LIMITS.mapNodes} nós). Rótulos curtos; detalhe vai em "nota".`,
    write: true,
    inputSchema: {
      type: 'object',
      $defs: {
        no: {
          type: 'object',
          properties: {
            titulo: { type: 'string', maxLength: MATERIAL_LIMITS.labelChars },
            nota: { type: 'string', maxLength: MATERIAL_LIMITS.noteChars, description: 'Explicação curta opcional.' },
            filhos: { type: 'array', items: { $ref: '#/$defs/no' } }
          },
          required: ['titulo']
        }
      },
      properties: {
        ...commonProps,
        descricao: { type: 'string', maxLength: MATERIAL_LIMITS.leadChars },
        tema_central: { $ref: '#/$defs/no' }
      },
      required: ['titulo', 'tema_central']
    }
  },
  {
    name: 'salvar_noticia',
    title: 'Salvar notícia ou post de blog no Memora',
    description: 'Guarda uma notícia ou post de blog educacional (vestibular, concursos, ciência, educação). Informe sempre o link e o nome do veículo ou blog original; o texto deve ser uma síntese com suas palavras, não uma cópia.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        ...commonProps,
        descricao: { type: 'string', description: 'Linha fina: o essencial em uma ou duas frases.', maxLength: MATERIAL_LIMITS.leadChars },
        texto: { type: 'string', description: 'Síntese em Markdown.', maxLength: MATERIAL_LIMITS.textChars },
        url_original: { type: 'string', description: 'Link da publicação original.' },
        veiculo: { type: 'string', description: 'Nome do blog, portal ou instituição.' },
        fontes: sourcesProp
      },
      required: ['titulo', 'descricao', 'texto']
    }
  },
  {
    name: 'buscar_comunidade',
    title: 'Buscar na comunidade Memora',
    description: 'Procura flashcards, resumos, mapas mentais e notícias publicados pela comunidade. Útil para reaproveitar material antes de gerar algo novo.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Termo de busca, ao menos 3 letras.' },
        tipo: { type: 'string', enum: ['flashcards', ...KINDS] },
        categoria: { type: 'string', description: CATEGORY_HINT },
        limite: { type: 'integer', minimum: 1, maximum: 20 }
      },
      required: ['consulta']
    }
  },
  {
    name: 'ler_conteudo',
    title: 'Ler conteúdo da comunidade',
    description: 'Traz o conteúdo completo de um item da comunidade (cards de um deck, texto de resumo ou notícia, árvore de mapa mental) para usar na conversa. Use o id retornado por buscar_comunidade.',
    readOnly: true,
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
  },
  {
    name: 'meus_conteudos',
    title: 'Listar meus conteúdos no Memora',
    description: 'Lista o que o aluno guardou no Memora (decks e materiais), com o status de publicação de cada um.',
    readOnly: true,
    inputSchema: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 50 } } }
  },
  {
    name: 'listar_categorias',
    title: 'Categorias do Memora',
    description: 'Lista as categorias e os tipos de conteúdo aceitos pelo Memora.',
    readOnly: true,
    inputSchema: { type: 'object', properties: {} }
  }
]

export function toolList() {
  return TOOLS.map(({ write, readOnly, ...tool }) => ({
    ...tool,
    annotations: { title: tool.title, readOnlyHint: Boolean(readOnly), destructiveHint: false, idempotentHint: Boolean(readOnly), openWorldHint: false }
  }))
}

export function toolCatalog() {
  return TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, write: Boolean(t.write) }))
}

export class ToolInputError extends Error {}

const str = (value, max) => String(value ?? '').trim().slice(0, max)

function writesToday(state, userId) {
  const since = Date.now() - 86400000
  return state.mcp.activity.filter((a) => a.userId === userId && a.write && a.ok && new Date(a.at).getTime() >= since).length
}

function categoryOf(state, value) {
  const v = String(value || '').toLowerCase()
  return state.categories.find((c) => c.id === v || c.name.toLowerCase() === v)?.id || 'outros'
}

function sourceOf(connection) {
  return { channel: 'mcp', client: connection.name, clientId: connection.client || null, connectionId: connection.id }
}

function publishOutcome(result, kindLabel) {
  if (!result) return { status: 'privado', message: `${kindLabel} guardado só na conta do aluno. Ele pode publicar depois pelo app.` }
  if (result.error) {
    const why = result.error.code === 'policy_acceptance_required' ? 'o aluno ainda não aceitou a política de conteúdo (é só uma vez, pelo app)' : result.error.message
    return { status: 'privado', message: `Guardado, mas não enviado à comunidade: ${why}`, blockedBy: result.error.code }
  }
  return { status: 'em_triagem', message: `Enviado para a moderação da comunidade. Prazo de revisão: até ${result.sla.hours} h.`, publicationId: result.publication.id }
}

function saveFlashcards(ctx, args) {
  const { state, user, connection } = ctx
  const title = str(args.titulo, MATERIAL_LIMITS.titleChars)
  if (!title) throw new ToolInputError('Informe o título do deck.')
  const cards = Array.isArray(args.cards) ? args.cards : []
  if (!cards.length) throw new ToolInputError('Envie ao menos um card com frente e verso.')
  if (cards.length > MCP_LIMITS.cardsPerCall) throw new ToolInputError(`Envie até ${MCP_LIMITS.cardsPerCall} cards por chamada.`)
  const clean = cards.map((c, i) => {
    const front = str(c?.frente ?? c?.front, MCP_LIMITS.cardChars)
    const back = str(c?.verso ?? c?.back, MCP_LIMITS.cardChars)
    if (!front || !back) throw new ToolInputError(`O card ${i + 1} está sem frente ou sem verso.`)
    return { front, back }
  })
  const lang = args.idioma === 'en' ? 'en' : 'pt-BR'
  const deck = {
    id: id('d'),
    ownerId: user.id,
    name: title,
    categoryId: categoryOf(state, args.categoria),
    tags: Array.isArray(args.tags) ? args.tags.map((t) => str(t, 40).toLowerCase()).filter(Boolean).slice(0, 8) : [],
    difficulty: ['facil', 'medio', 'dificil'].includes(args.dificuldade) ? args.dificuldade : 'medio',
    lang,
    difficult: false,
    focus: false,
    complementary: false,
    pinned: false,
    favorite: false,
    folderId: null,
    source: { type: 'mcp', document: `Conversa em ${connection.name}`, pages: null, connectionId: connection.id },
    scheduled: false,
    createdAt: nowIso(),
    lastStudiedAt: null,
    publication: { status: 'nao_publicado' }
  }
  state.decks.push(deck)
  clean.forEach((c, i) => {
    state.cards.push({ id: id('c'), deckId: deck.id, type: 'text', front: c.front, back: c.back, media: null, lang, origin: { document: `Conversa em ${connection.name}`, page: null, excerpt: null, model: connection.client || null, promptVersion: null }, uncertain: false, sched: { state: 'new', stability: 0, difficulty: 5, due: nowIso(), lastReview: null, reps: 0, lapses: 0, consecutiveLapses: 0 }, order: i })
  })
  user.publicProfile.cardsGenerated = (user.publicProfile.cardsGenerated || 0) + clean.length
  const outcome = publishOutcome(args.publicar ? submitDeckPublication(state, user, deck, {}) : null, 'Deck')
  const link = `${appUrl()}/app/decks/${deck.id}`
  return {
    target: { type: 'deck', id: deck.id, title },
    text: `Deck "${title}" salvo no Memora com ${clean.length} cards em ${categoryName(state, deck.categoryId)}. ${outcome.message}\nAbrir: ${link}`,
    structured: { id: deck.id, tipo: 'flashcards', titulo: title, cards: clean.length, status: outcome.status, link, ...(outcome.blockedBy ? { bloqueio: outcome.blockedBy } : {}) }
  }
}

function saveMaterial(kind) {
  return (ctx, args) => {
    const { state, user, connection } = ctx
    const input = {
      title: args.titulo,
      categoryId: categoryOf(state, args.categoria),
      tags: args.tags,
      lang: args.idioma,
      description: args.descricao,
      text: args.texto,
      sources: args.fontes,
      root: args.tema_central,
      url: args.url_original,
      outlet: args.veiculo
    }
    let data
    try {
      data = normalizeMaterialInput(state, kind, input)
    } catch (err) {
      if (err instanceof MaterialInputError) throw new ToolInputError(err.message)
      throw err
    }
    const material = createMaterial(state, { ownerId: user.id, kind, data, source: sourceOf(connection) })
    const label = KIND_LABELS[kind]
    const outcome = publishOutcome(args.publicar ? submitMaterialPublication(state, user, material, {}) : null, label)
    const link = `${appUrl()}/app/comunidade/conteudo/${material.id}`
    const size = kind === 'mapa' ? `${countNodes(material.body.root)} nós` : `${String(material.body.markdown).split(/\s+/).filter(Boolean).length} palavras`
    return {
      target: { type: 'material', id: material.id, title: material.title },
      text: `${label} "${material.title}" salvo no Memora (${size}). ${outcome.message}\nAbrir: ${link}`,
      structured: { id: material.id, tipo: kind, titulo: material.title, status: outcome.status, link, ...(outcome.blockedBy ? { bloqueio: outcome.blockedBy } : {}) }
    }
  }
}

function searchCommunity(ctx, args) {
  const { state, user } = ctx
  const q = str(args.consulta, 80).toLowerCase()
  if (q.length < 3) throw new ToolInputError('A consulta precisa de ao menos 3 letras.')
  const limit = Math.min(20, Math.max(1, Number(args.limite) || 8))
  const kind = ['flashcards', ...KINDS].includes(args.tipo) ? args.tipo : null
  const category = args.categoria ? categoryOf(state, args.categoria) : null
  const decks = state.community.decks.map((d) => ({ kind: 'flashcards', ...communityDeckPublic(state, d, user.id) }))
  const materials = publishedMaterials(state, user.id).map((m) => materialPublic(state, m, user.id))
  const results = [...decks, ...materials]
    .filter((x) => (!kind || x.kind === kind) && (!category || x.categoryId === category))
    .map((x) => {
      const name = x.name || x.title
      const hay = `${name} ${x.description} ${x.tags.join(' ')} ${x.author?.name || ''} ${x.categoryName}`.toLowerCase()
      return { x, score: name.toLowerCase().includes(q) ? 3 : hay.includes(q) ? 1 : 0 }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ x }) => ({
      id: x.id,
      tipo: x.kind,
      titulo: x.name || x.title,
      descricao: x.description,
      autor: x.author?.name || null,
      categoria: x.categoryName,
      ...(x.kind === 'flashcards' ? { cards: x.cardCount } : {}),
      link: x.kind === 'flashcards' ? `${appUrl()}/app/comunidade/deck/${x.id}` : `${appUrl()}/app/comunidade/conteudo/${x.id}`
    }))
  const lines = results.map((r) => `- [${KIND_LABELS[r.tipo]}] ${r.titulo} (id ${r.id})${r.autor ? `, por ${r.autor}` : ''}`)
  return {
    text: results.length ? `${results.length} resultado(s) para "${q}":\n${lines.join('\n')}` : `Nada publicado na comunidade para "${q}".`,
    structured: { resultados: results }
  }
}

function renderTree(node, depth = 0) {
  const line = `${'  '.repeat(depth)}- ${node.label}${node.note ? `: ${node.note}` : ''}`
  return [line, ...node.children.flatMap((c) => renderTree(c, depth + 1))]
}

function readContent(ctx, args) {
  const { state, user } = ctx
  const target = str(args.id, 60)
  const deck = state.community.decks.find((d) => d.id === target)
  if (deck) {
    const cards = state.community.cards.filter((c) => c.deckId === deck.id)
    return {
      text: `Flashcards "${deck.name}" (${cards.length} cards)\n\n${cards.map((c, i) => `${i + 1}. ${c.front}\n   → ${c.back}`).join('\n')}`,
      structured: { id: deck.id, tipo: 'flashcards', titulo: deck.name, cards: cards.map((c) => ({ frente: c.front, verso: c.back })) }
    }
  }
  const m = state.materials.find((x) => x.id === target && !x.deletedAt && (x.status === 'aprovado' || x.ownerId === user.id))
  if (!m) throw new ToolInputError('Conteúdo não encontrado ou ainda não publicado.')
  const header = `${KIND_LABELS[m.kind]} "${m.title}"${m.description ? `\n${m.description}` : ''}`
  if (m.kind === 'mapa') {
    return { text: `${header}\n\n${renderTree(m.body.root).join('\n')}`, structured: { id: m.id, tipo: m.kind, titulo: m.title, tema_central: m.body.root } }
  }
  const sources = [...(m.body.url ? [`${m.body.outlet || 'Original'}: ${m.body.url}`] : []), ...(m.body.sources || []).map((s) => (s.url ? `${s.title}: ${s.url}` : s.title))]
  return {
    text: `${header}\n\n${m.body.markdown}${sources.length ? `\n\nFontes:\n${sources.map((s) => `- ${s}`).join('\n')}` : ''}`,
    structured: { id: m.id, tipo: m.kind, titulo: m.title, texto: m.body.markdown, fontes: sources }
  }
}

function myContents(ctx, args) {
  const { state, user } = ctx
  const limit = Math.min(50, Math.max(1, Number(args.limite) || 15))
  const decks = state.decks
    .filter((d) => d.ownerId === user.id && !d.deletedAt)
    .map((d) => ({ id: d.id, tipo: 'flashcards', titulo: d.name, status: d.publication?.status || 'nao_publicado', criadoEm: d.createdAt, link: `${appUrl()}/app/decks/${d.id}` }))
  const materials = state.materials
    .filter((m) => m.ownerId === user.id && !m.deletedAt)
    .map((m) => ({ id: m.id, tipo: m.kind, titulo: m.title, status: m.status, criadoEm: m.createdAt, link: `${appUrl()}/app/comunidade/conteudo/${m.id}` }))
  const items = [...materials, ...decks].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limit)
  return {
    text: items.length ? items.map((i) => `- [${KIND_LABELS[i.tipo]}] ${i.titulo} (${i.status})`).join('\n') : 'Nada guardado ainda.',
    structured: { itens: items }
  }
}

function listCategories(ctx) {
  const categories = ctx.state.categories.map((c) => ({ id: c.id, nome: c.name }))
  return {
    text: `Categorias: ${categories.map((c) => `${c.id} (${c.nome})`).join(', ')}.\nTipos: flashcards, resumo, mapa (mapa mental), noticia.`,
    structured: { categorias: categories, tipos: ['flashcards', ...KINDS] }
  }
}

const HANDLERS = {
  salvar_flashcards: saveFlashcards,
  salvar_resumo: saveMaterial('resumo'),
  salvar_mapa_mental: saveMaterial('mapa'),
  salvar_noticia: saveMaterial('noticia'),
  buscar_comunidade: searchCommunity,
  ler_conteudo: readContent,
  meus_conteudos: myContents,
  listar_categorias: listCategories
}

export function hasTool(name) {
  return Boolean(HANDLERS[name])
}

export function callTool(ctx, name, args = {}) {
  const { state, user, connection } = ctx
  const def = TOOLS.find((t) => t.name === name)
  const entry = { id: id('act'), userId: user.id, connectionId: connection.id, client: connection.client || null, tool: name, write: Boolean(def.write), ok: false, targetType: null, targetId: null, title: null, at: nowIso() }
  try {
    if (def.write && writesToday(state, user.id) >= MCP_LIMITS.writesPerDay) throw new ToolInputError(`Limite de ${MCP_LIMITS.writesPerDay} conteúdos salvos por dia via IA atingido. Tente amanhã.`)
    const out = HANDLERS[name](ctx, args && typeof args === 'object' ? args : {})
    entry.ok = true
    if (out.target) Object.assign(entry, { targetType: out.target.type, targetId: out.target.id, title: out.target.title })
    if (def.write) appendAudit(state, { actor: user.id, actorRole: 'student', action: 'mcp_content_saved', target: out.target.id, details: { tool: name, connectionId: connection.id } })
    return { content: [{ type: 'text', text: out.text }], structuredContent: out.structured, isError: false }
  } catch (err) {
    if (!(err instanceof ToolInputError)) throw err
    entry.error = err.message
    return { content: [{ type: 'text', text: err.message }], isError: true }
  } finally {
    state.mcp.activity.unshift(entry)
    if (state.mcp.activity.length > 500) state.mcp.activity.length = 500
  }
}
