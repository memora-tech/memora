import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'

let store
let app

const auth = (token) => ({ Authorization: `Bearer ${token}` })

async function studentToken() {
  return (await request(app).post('/v1/auth/login').send({ provider: 'google' })).body.token
}

async function connect(student) {
  const res = await request(app).post('/v1/mcp/connections').set(auth(student)).send({ name: 'Claude Desktop' })
  return res.body.token
}

let seq = 0
function rpc(token, method, params) {
  seq += 1
  return request(app).post('/v1/mcp').set(auth(token)).send({ jsonrpc: '2.0', id: seq, method, ...(params ? { params } : {}) })
}

const call = (token, name, args) => rpc(token, 'tools/call', { name, arguments: args })

const MAPA = {
  titulo: 'Revolução Francesa',
  categoria: 'vestibular',
  tema_central: { titulo: 'Revolução Francesa', filhos: [{ titulo: 'Causas', filhos: [{ titulo: 'Crise fiscal' }, { titulo: 'Iluminismo' }] }, { titulo: 'Fases', nota: 'Monarquia constitucional, Convenção, Diretório' }] }
}

beforeEach(() => {
  store = createStore()
  app = createApp(store)
})

describe('servidor MCP', () => {
  it('cria conexão com token mostrado uma vez e guardado só como hash', async () => {
    const student = await studentToken()
    const res = await request(app).post('/v1/mcp/connections').set(auth(student)).send({ name: 'Claude Desktop' })
    expect(res.status).toBe(201)
    expect(res.body.token).toMatch(/^mcp_/)
    expect(res.body.connection.tokenHash).toBeUndefined()
    const saved = store.state.mcp.connections.find((c) => c.id === res.body.connection.id)
    expect(saved.token).toBeUndefined()
    expect(saved.tokenHash).not.toContain(res.body.token)
    const list = await request(app).get('/v1/mcp/connections').set(auth(student))
    expect(list.body.tools.map((t) => t.name)).toContain('salvar_mapa_mental')
    expect(JSON.stringify(list.body)).not.toContain(res.body.token)
  })

  it('initialize negocia a versão e tools/list expõe as 8 ferramentas', async () => {
    const token = await connect(await studentToken())
    const init = await rpc(token, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'claude-ai', version: '1' } })
    expect(init.body.result.protocolVersion).toBe('2025-03-26')
    expect(init.body.result.capabilities.tools).toBeTruthy()
    const unknownVersion = await rpc(token, 'initialize', { protocolVersion: '1999-01-01' })
    expect(unknownVersion.body.result.protocolVersion).toBe('2025-06-18')
    const note = await request(app).post('/v1/mcp').set(auth(token)).send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(note.status).toBe(202)
    const tools = await rpc(token, 'tools/list')
    expect(tools.body.result.tools).toHaveLength(8)
    expect(tools.body.result.tools.find((t) => t.name === 'buscar_comunidade').annotations.readOnlyHint).toBe(true)
  })

  it('recusa sem token, com token revogado e método desconhecido', async () => {
    const anon = await request(app).post('/v1/mcp').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(anon.status).toBe(401)
    expect(anon.headers['www-authenticate']).toContain('Bearer')
    const student = await studentToken()
    const created = await request(app).post('/v1/mcp/connections').set(auth(student)).send({ name: 'Cursor' })
    const unknown = await rpc(created.body.token, 'sampling/createMessage')
    expect(unknown.body.error.code).toBe(-32601)
    await request(app).delete(`/v1/mcp/connections/${created.body.connection.id}`).set(auth(student))
    const revoked = await rpc(created.body.token, 'tools/list')
    expect(revoked.status).toBe(401)
  })

  it('salvar_flashcards cria o deck na biblioteca do aluno', async () => {
    const student = await studentToken()
    const token = await connect(student)
    const res = await call(token, 'salvar_flashcards', { titulo: 'Verbos irregulares', categoria: 'idiomas', cards: [{ frente: 'go', verso: 'went / gone' }, { frente: 'see', verso: 'saw / seen' }] })
    expect(res.body.result.isError).toBe(false)
    expect(res.body.result.structuredContent.cards).toBe(2)
    const decks = await request(app).get('/v1/decks').set(auth(student))
    expect(JSON.stringify(decks.body)).toContain('Verbos irregulares')
  })

  it('erro de entrada volta como isError sem derrubar a conexão', async () => {
    const token = await connect(await studentToken())
    const res = await call(token, 'salvar_resumo', { titulo: 'Curto', texto: 'pouco' })
    expect(res.status).toBe(200)
    expect(res.body.result.isError).toBe(true)
    expect(res.body.result.content[0].text).toMatch(/40 caracteres/)
    const bad = await call(token, 'salvar_tudo', {})
    expect(bad.body.error.code).toBe(-32602)
  })

  it('mapa mental com publicar=true fica privado até o aceite da política e depois passa pela moderação', async () => {
    const student = await studentToken()
    const token = await connect(student)
    const saved = await call(token, 'salvar_mapa_mental', { ...MAPA, publicar: true })
    const out = saved.body.result.structuredContent
    expect(out.status).toBe('privado')
    expect(out.bloqueio).toBe('policy_acceptance_required')

    const feedBefore = await request(app).get('/v1/community/feed').set(auth(student))
    expect(feedBefore.body.materials.mapa.some((m) => m.id === out.id)).toBe(false)
    const mine = await request(app).get('/v1/me/materials').set(auth(student))
    expect(mine.body.items.find((m) => m.id === out.id).status).toBe('privado')

    const pub = await request(app).post(`/v1/me/materials/${out.id}/publish`).set(auth(student)).send({ acceptPolicy: true })
    expect(pub.status).toBe(201)
    expect(pub.body.material.status).toBe('em_triagem')

    const mod = (await request(app).post('/v1/admin/auth/login').send({ role: 'moderador' })).body.token
    const queue = await request(app).get('/v1/admin/moderation/queue').set(auth(mod))
    const item = queue.body.queue.find((p) => p.materialId === out.id)
    expect(item.kind).toBe('material')
    const detail = await request(app).get(`/v1/admin/moderation/${item.id}`).set(auth(mod))
    expect(detail.body.publication.snapshot.some((c) => c.front.includes('Causas → Crise fiscal'))).toBe(true)
    const decided = await request(app).post(`/v1/admin/moderation/${item.id}/decide`).set(auth(mod)).send({ decision: 'aprovado' })
    expect(decided.body.publication.status).toBe('aprovado')

    const feed = await request(app).get('/v1/community/feed').set(auth(student))
    expect(feed.body.materials.mapa[0].id).toBe(out.id)
    expect(feed.body.latest.some((x) => x.id === out.id)).toBe(true)
    const search = await request(app).get('/v1/community/search?q=revolução&kind=mapa').set(auth(student))
    expect(search.body.results.map((r) => r.id)).toEqual([out.id])
  })

  it('com a política aceita, publicar=true envia direto para a fila', async () => {
    const student = await studentToken()
    store.state.consents.u1.contentPolicyAcceptedVersion = store.state.admin.policy.version
    const token = await connect(student)
    const res = await call(token, 'salvar_noticia', { titulo: 'Inscrições do ENEM abertas', descricao: 'Prazo vai até o fim do mês e a taxa pode ser isenta.', texto: 'As inscrições podem ser feitas pela página do participante. Quem é de escola pública tem isenção automática.', url_original: 'https://www.exemplo.gov.br/enem', publicar: true })
    expect(res.body.result.structuredContent.status).toBe('em_triagem')
    const material = store.state.materials.find((m) => m.id === res.body.result.structuredContent.id)
    expect(material.body.outlet).toBe('exemplo.gov.br')
    expect(material.source.client).toBe('Claude Desktop')
  })

  it('buscar_comunidade e ler_conteudo trazem material publicado para a conversa', async () => {
    const token = await connect(await studentToken())
    const found = await call(token, 'buscar_comunidade', { consulta: 'krebs' })
    const ids = found.body.result.structuredContent.resultados.map((r) => r.id)
    expect(ids).toContain('c1')
    const read = await call(token, 'ler_conteudo', { id: 'c1' })
    expect(read.body.result.content[0].text).toContain('matriz mitocondrial')
    const map = await call(token, 'ler_conteudo', { id: 'm2' })
    expect(map.body.result.content[0].text).toContain('  - Ciclo cardíaco')
    const hidden = await call(token, 'ler_conteudo', { id: 'm7' })
    expect(hidden.body.result.isError).toBe(false)
  })

  it('não expõe material privado de outro aluno', async () => {
    store.state.materials.find((m) => m.id === 'm7').ownerId = 'x1'
    const student = await studentToken()
    const res = await request(app).get('/v1/community/materials/m7').set(auth(student))
    expect(res.status).toBe(404)
    const token = await connect(student)
    const read = await call(token, 'ler_conteudo', { id: 'm7' })
    expect(read.body.result.isError).toBe(true)
  })
})

describe('comunidade com vários tipos de conteúdo', () => {
  it('feed traz contagem por tipo, novidades misturadas e estado da conexão de IA', async () => {
    const student = await studentToken()
    const feed = await request(app).get('/v1/community/feed').set(auth(student))
    expect(feed.body.counts).toMatchObject({ flashcards: 7, resumo: 2, mapa: 2, noticia: 2, mine: 8 })
    expect(new Set(feed.body.latest.map((x) => x.kind)).size).toBeGreaterThan(1)
    expect(feed.body.mcp).toBeUndefined()
    expect(feed.body.sources.map((s) => s.client)).toContain('Claude')
  })

  it('visão da Nôa reúne sugestões, decisões e o resumo das conexões MCP', async () => {
    const student = await studentToken()
    const res = await request(app).get('/v1/noa/overview').set(auth(student))
    expect(res.body.suggestions).toHaveLength(1)
    expect(res.body.decisions.length).toBeGreaterThan(0)
    expect(res.body.mcp).toEqual({ connections: 1, aiSaved: 1 })
    expect(res.body.insights.today.cardsDue).toBe(18)
    expect(res.body.insights.weakest).toMatchObject({ id: 'd1', name: 'Direito Constitucional' })
    expect(res.body.insights.objective).toMatchObject({ name: 'ENEM', daysLeft: 23 })
  })
})

describe('simulação de envio pelo MCP', () => {
  it('simular cria o deck pelo servidor MCP, fora do estudo, e avisa na caixa de entrada até ser visto', async () => {
    const student = await studentToken()
    const sim = await request(app).post('/v1/mcp/simulate').set(auth(student))
    expect(sim.status).toBe(201)
    expect(sim.body.result).toMatchObject({ tipo: 'flashcards', titulo: 'Revolução Francesa: causas e fases', cards: 6 })
    const inbox = await request(app).get('/v1/mcp/inbox').set(auth(student))
    expect(inbox.body.items).toHaveLength(1)
    const item = inbox.body.items[0]
    expect(item).toMatchObject({ source: 'Claude Desktop', deck: { cardCount: 6, scheduled: false } })
    expect(item.preview[0].front).toMatch(/1789|começou/)
    await request(app).post(`/v1/mcp/inbox/${item.id}/seen`).set(auth(student))
    const after = await request(app).get('/v1/mcp/inbox').set(auth(student))
    expect(after.body.items).toHaveLength(0)
    const second = await request(app).post('/v1/mcp/simulate').set(auth(student))
    expect(second.body.result.titulo).toBe('Genética: leis de Mendel')
  })
})

describe('decks programados para estudo', () => {
  it('só decks programados entram no plano do dia, e o aluno muda isso na aba Decks', async () => {
    const student = await studentToken()
    const before = await request(app).get('/v1/study/today').set(auth(student))
    expect(before.body.scheduledDecks.map((d) => d.id).sort()).toEqual(['d1', 'd2', 'd3', 'd5'])
    expect(before.body.unscheduledCount).toBe(2)
    const off = await request(app).patch('/v1/decks/d3').set(auth(student)).send({ scheduled: false })
    expect(off.body.deck.scheduled).toBe(false)
    const after = await request(app).get('/v1/study/today').set(auth(student))
    expect(after.body.plan.some((p) => p.deckId === 'd3')).toBe(false)
    expect(after.body.cardsDue).toBe(before.body.cardsDue - 4)
    const on = await request(app).patch('/v1/decks/d4').set(auth(student)).send({ scheduled: true })
    expect(on.body.deck.scheduled).toBe(true)
    const last = await request(app).get('/v1/study/today').set(auth(student))
    expect(last.body.scheduledDecks.find((d) => d.id === 'd4')).toMatchObject({ name: 'Farmacologia' })
  })

  it('favoritar e reagir em material alternam e contam', async () => {
    const student = await studentToken()
    const fav = await request(app).post('/v1/community/materials/m1/favorite').set(auth(student))
    expect(fav.body).toMatchObject({ favorited: true, favorites: 313 })
    const unfav = await request(app).post('/v1/community/materials/m1/favorite').set(auth(student))
    expect(unfav.body.favorited).toBe(false)
    const react = await request(app).post('/v1/community/materials/m1/react').set(auth(student)).send({ emoji: '💡' })
    expect(react.body.mine).toEqual(['💡'])
    const detail = await request(app).get('/v1/community/materials/m1').set(auth(student))
    expect(detail.body.material.body.markdown).toContain('## 1. Glicólise')
    expect(detail.body.material.viewer.myReactions).toEqual(['💡'])
  })
})

describe('blog, público e comentários', () => {
  const POST = { title: 'Minha rotina de revisão', description: 'Como uso flashcards 15 minutos por dia e mantenho a sequência.', text: 'Revisar pouco todo dia rende mais do que revisar muito de vez em quando. Eu uso o modo pontos fracos no fim do dia.', categoryId: 'outros', tags: ['rotina'] }

  it('aluno escreve post, compartilha só com seguidores e só quem segue vê', async () => {
    const student = await studentToken()
    store.state.consents.u1.contentPolicyAcceptedVersion = store.state.admin.policy.version
    const created = await request(app).post('/v1/me/materials').set(auth(student)).send(POST)
    expect(created.status).toBe(201)
    expect(created.body.material).toMatchObject({ kind: 'noticia', status: 'privado', aiGenerated: false })
    const id = created.body.material.id
    const shared = await request(app).post(`/v1/me/materials/${id}/publish`).set(auth(student)).send({ audience: 'seguidores' })
    expect(shared.body.material).toMatchObject({ status: 'aprovado', audience: 'seguidores' })
    const m = store.state.materials.find((x) => x.id === id)
    const { canSeeMaterial } = await import('../src/lib/materials.js')
    expect(canSeeMaterial(store.state, m, 'x9')).toBe(false)
    store.state.community.follows.push({ userId: 'x9', authorId: 'u1' })
    expect(canSeeMaterial(store.state, m, 'x9')).toBe(true)
    const mine = await request(app).get('/v1/me/publications').set(auth(student))
    expect(mine.body.items.find((i) => i.id === id).audience).toBe('seguidores')
    expect(mine.body.items.some((i) => i.kind === 'flashcards')).toBe(true)
  })

  it('compartilhar com a comunidade passa pela moderação', async () => {
    const student = await studentToken()
    const created = await request(app).post('/v1/me/materials').set(auth(student)).send(POST)
    const res = await request(app).post(`/v1/me/materials/${created.body.material.id}/publish`).set(auth(student)).send({ audience: 'comunidade', acceptPolicy: true })
    expect(res.body.material.status).toBe('em_triagem')
    expect(res.body.sla.hours).toBeGreaterThan(0)
  })

  it('comentários em conteúdos da comunidade, com respostas', async () => {
    const student = await studentToken()
    const list = await request(app).get('/v1/community/materials/m3/comments').set(auth(student))
    expect(list.body.total).toBe(2)
    const sent = await request(app).post('/v1/community/materials/m3/comments').set(auth(student)).send({ text: 'Ótima explicação!' })
    expect(sent.status).toBe(201)
    const reply = await request(app).post('/v1/community/materials/m3/comments').set(auth(student)).send({ text: 'Concordo', parentId: 'cm5' })
    expect(reply.status).toBe(201)
    const detail = await request(app).get('/v1/community/materials/m3').set(auth(student))
    expect(detail.body.material.commentCount).toBe(4)
    const deckComments = await request(app).get('/v1/community/decks/c1/comments').set(auth(student))
    expect(deckComments.body.threads.every((c) => c.deckId === 'c1')).toBe(true)
  })
})

describe('post de blog vindo de outra IA até a comunidade', () => {
  it('chega pelo MCP privado, o aluno compartilha, a moderação aprova e aparece no Blog', async () => {
    const student = await studentToken()
    const sim = await request(app).post('/v1/mcp/simulate').set(auth(student)).send({ kind: 'noticia' })
    expect(sim.status).toBe(201)
    expect(sim.body.result).toMatchObject({ tipo: 'noticia', status: 'privado', titulo: 'Pomodoro funciona para estudar para o ENEM?' })
    const id = sim.body.result.id

    const inbox = await request(app).get('/v1/mcp/inbox').set(auth(student))
    expect(inbox.body.items[0]).toMatchObject({ kind: 'noticia', source: 'Claude Desktop', material: { id, status: 'privado' } })

    const before = await request(app).get('/v1/community/feed').set(auth(student))
    expect(before.body.materials.noticia.some((m) => m.id === id)).toBe(false)

    const shared = await request(app).post(`/v1/me/materials/${id}/publish`).set(auth(student)).send({ audience: 'comunidade', acceptPolicy: true })
    expect(shared.body.material.status).toBe('em_triagem')

    const mod = (await request(app).post('/v1/admin/auth/login').send({ role: 'moderador' })).body.token
    const queue = await request(app).get('/v1/admin/moderation/queue').set(auth(mod))
    const pub = queue.body.queue.find((p) => p.materialId === id)
    expect(pub.materialKind).toBe('noticia')
    await request(app).post(`/v1/admin/moderation/${pub.id}/decide`).set(auth(mod)).send({ decision: 'aprovado' })

    const after = await request(app).get('/v1/community/feed').set(auth(student))
    const post = after.body.materials.noticia.find((m) => m.id === id)
    expect(post).toMatchObject({ status: 'aprovado', audience: 'comunidade', aiGenerated: true, source: { client: 'Claude Desktop' } })
  })
})
