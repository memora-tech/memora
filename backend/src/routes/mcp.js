import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { requireStudent } from '../lib/auth.js'
import { fail, categoryName } from '../lib/helpers.js'
import { MCP_SAMPLES } from '../seed/mcpSamples.js'
import { id, nowIso, sha256 } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'
import { MCP_LIMITS, appUrl, callTool, hasTool, toolCatalog, toolList } from '../lib/mcpTools.js'

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const SERVER_INFO = { name: 'memora', title: 'Memora', version: '0.2.0' }

const INSTRUCTIONS = [
  'Memora é uma comunidade de estudos. Use estas ferramentas para guardar no Memora o que foi criado nesta conversa:',
  'salvar_flashcards (decks para repetição espaçada), salvar_resumo, salvar_mapa_mental e salvar_noticia (posts de blog e notícias de educação, sempre com link e veículo originais).',
  'Antes de gerar algo do zero, use buscar_comunidade para ver se já existe material publicado; ler_conteudo traz o conteúdo completo.',
  'Só envie à comunidade (publicar: true) quando o aluno pedir explicitamente; por padrão tudo fica privado na conta dele.'
].join(' ')

const rpcError = (idValue, code, message, data) => ({ jsonrpc: '2.0', id: idValue ?? null, error: { code, message, ...(data ? { data } : {}) } })
const rpcResult = (idValue, result) => ({ jsonrpc: '2.0', id: idValue, result })

function connectionPublic(c) {
  const { tokenHash: _h, token: _t, ...rest } = c
  return { ...rest, active: !c.revokedAt }
}

function mcpAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  const state = req.store.state
  const connection = token ? state.mcp.connections.find((c) => c.tokenHash && c.tokenHash === sha256(token) && !c.revokedAt) : null
  if (!connection) {
    res.set('WWW-Authenticate', 'Bearer realm="memora-mcp"')
    return res.status(401).json(rpcError(req.body?.id, -32001, 'Token MCP inválido ou revogado. Gere um novo em Comunidade › Conectar IA.'))
  }
  const user = state.users.find((u) => u.id === connection.userId)
  if (!user || user.deactivatedAt) return res.status(403).json(rpcError(req.body?.id, -32001, 'Conta desativada: reative no app para usar a conexão.'))
  connection.lastUsedAt = nowIso()
  req.mcp = { state, user, connection }
  next()
}

function handleRpc(ctx, msg) {
  const { connection } = ctx
  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion
      const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0]
      const clientInfo = msg.params?.clientInfo
      if (clientInfo?.name) connection.client = String(clientInfo.name).slice(0, 60)
      return rpcResult(msg.id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS })
    }
    case 'ping':
      return rpcResult(msg.id, {})
    case 'tools/list':
      return rpcResult(msg.id, { tools: toolList() })
    case 'tools/call': {
      const name = msg.params?.name
      if (!hasTool(name)) return rpcError(msg.id, -32602, `Ferramenta desconhecida: ${name}`)
      return rpcResult(msg.id, callTool(ctx, name, msg.params?.arguments || {}))
    }
    case 'resources/list':
      return rpcResult(msg.id, { resources: [] })
    case 'prompts/list':
      return rpcResult(msg.id, { prompts: [] })
    default:
      return rpcError(msg.id, -32601, `Método não suportado: ${msg.method}`)
  }
}

export function mcpRoutes() {
  const r = Router()

  r.get('/mcp/connections', requireStudent, (req, res) => {
    const state = req.store.state
    const connections = state.mcp.connections.filter((c) => c.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(connectionPublic)
    const activity = state.mcp.activity.filter((a) => a.userId === req.user.id).slice(0, 20)
    res.json({ endpointPath: '/v1/mcp', appUrl: appUrl(), protocolVersions: MCP_PROTOCOL_VERSIONS, connections, activity, tools: toolCatalog(), limits: MCP_LIMITS })
  })

  r.post('/mcp/connections', requireStudent, (req, res) => {
    const state = req.store.state
    const name = String(req.body?.name || '').trim().slice(0, 40)
    if (!name) return fail(res, 422, 'validation', 'Dê um nome para a conexão, por exemplo "Claude Desktop".')
    const active = state.mcp.connections.filter((c) => c.userId === req.user.id && !c.revokedAt)
    if (active.length >= MCP_LIMITS.activeConnections) return fail(res, 409, 'connection_limit', `Você pode ter até ${MCP_LIMITS.activeConnections} conexões ativas. Revogue uma para criar outra.`)
    const token = `mcp_${randomBytes(24).toString('base64url')}`
    const connection = { id: id('mcp'), userId: req.user.id, name, tokenHash: sha256(token), tokenHint: token.slice(-4), client: null, createdAt: nowIso(), lastUsedAt: null, revokedAt: null }
    state.mcp.connections.push(connection)
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'mcp_connection_created', target: connection.id, details: { name } })
    res.status(201).json({ connection: connectionPublic(connection), token, notice: 'Copie o token agora. Por segurança ele não aparece de novo.' })
  })

  r.delete('/mcp/connections/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const connection = state.mcp.connections.find((c) => c.id === req.params.id && c.userId === req.user.id)
    if (!connection) return fail(res, 404, 'not_found', 'Conexão não encontrada.')
    if (!connection.revokedAt) {
      connection.revokedAt = nowIso()
      appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'mcp_connection_revoked', target: connection.id, details: {} })
    }
    res.json({ connection: connectionPublic(connection) })
  })

  r.get('/mcp/inbox', requireStudent, (req, res) => {
    const state = req.store.state
    const items = state.mcp.activity
      .filter((a) => a.userId === req.user.id && a.ok && a.write && a.targetType === 'deck' && !a.seenAt)
      .map((a) => {
        const deck = state.decks.find((d) => d.id === a.targetId && !d.deletedAt)
        if (!deck) return null
        const cards = state.cards.filter((c) => c.deckId === deck.id && !c.deletedAt)
        const connection = state.mcp.connections.find((c) => c.id === a.connectionId)
        return {
          id: a.id,
          at: a.at,
          source: connection?.name || 'IA',
          client: connection?.client || null,
          deck: { id: deck.id, name: deck.name, scheduled: deck.scheduled !== false, categoryName: categoryName(state, deck.categoryId), cardCount: cards.length },
          preview: cards.slice(0, 2).map((c) => ({ front: c.front, back: c.back }))
        }
      })
      .filter(Boolean)
    res.json({ items })
  })

  r.post('/mcp/inbox/:id/seen', requireStudent, (req, res) => {
    const entry = req.store.state.mcp.activity.find((a) => a.id === req.params.id && a.userId === req.user.id)
    if (!entry) return fail(res, 404, 'not_found', 'Aviso não encontrado.')
    entry.seenAt = nowIso()
    res.json({ ok: true })
  })

  r.post('/mcp/simulate', requireStudent, (req, res) => {
    const state = req.store.state
    let connection = state.mcp.connections.find((c) => c.userId === req.user.id && !c.revokedAt)
    if (!connection) {
      connection = { id: id('mcp'), userId: req.user.id, name: 'Claude Desktop', tokenHash: null, tokenHint: 'demo', client: 'claude-ai', createdAt: nowIso(), lastUsedAt: null, revokedAt: null, demo: true }
      state.mcp.connections.push(connection)
    }
    const sent = state.mcp.activity.filter((a) => a.userId === req.user.id && a.simulated).length
    const sample = MCP_SAMPLES[sent % MCP_SAMPLES.length]
    connection.lastUsedAt = nowIso()
    const result = callTool({ state, user: req.user, connection }, 'salvar_flashcards', sample)
    if (result.isError) return fail(res, 422, 'simulation_failed', result.content[0].text)
    state.mcp.activity[0].simulated = true
    res.status(201).json({ result: result.structuredContent, connection: { id: connection.id, name: connection.name }, activityId: state.mcp.activity[0].id })
  })

  r.post('/mcp', mcpAuth, (req, res) => {
    const msg = req.body
    if (Array.isArray(msg)) return res.status(400).json(rpcError(null, -32600, 'Lotes JSON-RPC não são suportados; envie uma mensagem por requisição.'))
    if (!msg || msg.jsonrpc !== '2.0') return res.status(400).json(rpcError(msg?.id, -32600, 'Requisição JSON-RPC 2.0 inválida.'))
    if (typeof msg.method !== 'string') return res.status(202).end()
    if (msg.id === undefined || msg.id === null) return res.status(202).end()
    res.json(handleRpc(req.mcp, msg))
  })

  const notAllowed = (_req, res) => res.set('Allow', 'POST').status(405).json(rpcError(null, -32000, 'Este servidor MCP responde só a POST (Streamable HTTP sem stream SSE).'))
  r.get('/mcp', notAllowed)
  r.delete('/mcp', notAllowed)

  return r
}
