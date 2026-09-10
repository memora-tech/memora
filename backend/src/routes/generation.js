import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, ensureDay, PLAN_LIMITS } from '../lib/helpers.js'
import { id, nowIso, hoursFromNow } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const TOKENS_PER_PAGE = 267
const READ_BUDGET_TOKENS = 200000

const SAMPLES = {
  file: {
    name: 'Revolução Francesa',
    categoryId: 'medio',
    tags: ['história', 'século XVIII'],
    difficulty: 'medio',
    cards: [
      ['Em que ano começou a Revolução Francesa?', '1789, com a Queda da Bastilha em 14 de julho.', false, 3],
      ['O que eram os Três Estados?', 'Clero, nobreza e o Terceiro Estado (burguesia, camponeses e trabalhadores urbanos).', false, 4],
      ['O que foi a Declaração dos Direitos do Homem e do Cidadão?', 'Documento de agosto de 1789 que afirmou liberdade, igualdade e soberania popular.', false, 6],
      ['Qual período ficou conhecido como o Terror?', '1793 a 1794, sob o Comitê de Salvação Pública liderado por Robespierre.', false, 9],
      ['Quem tomou o poder com o golpe do 18 de Brumário?', 'Napoleão Bonaparte, em 1799.', false, 12],
      ['O que foi a Constituição de 1791?', 'Estabeleceu a monarquia constitucional e o voto censitário.', true, 7],
      ['Qual foi o papel dos sans-culottes?', 'Trabalhadores urbanos radicais que pressionaram por medidas populares durante a revolução.', true, 10],
      ['Qual o lema da Revolução?', 'Liberdade, igualdade, fraternidade.', false, 2]
    ]
  },
  camera: {
    name: 'Fotossíntese',
    categoryId: 'vestibular',
    tags: ['biologia', 'botânica'],
    difficulty: 'facil',
    cards: [
      ['Onde ocorre a fotossíntese na célula vegetal?', 'Nos cloroplastos.', false, 1],
      ['Qual pigmento capta a luz na fotossíntese?', 'A clorofila, principalmente a clorofila a.', false, 1],
      ['Quais são os produtos da fase clara?', 'ATP, NADPH e O₂.', false, 2],
      ['Onde ocorre o ciclo de Calvin?', 'No estroma do cloroplasto.', false, 2],
      ['Qual gás é fixado no ciclo de Calvin?', 'O dióxido de carbono (CO₂).', true, 2],
      ['Qual a equação geral da fotossíntese?', '6 CO₂ + 6 H₂O + luz → C₆H₁₂O₆ + 6 O₂', false, 3]
    ]
  },
  text: {
    name: 'Termodinâmica: 1ª lei',
    categoryId: 'superior',
    tags: ['física', 'termodinâmica'],
    difficulty: 'medio',
    cards: [
      ['Enuncie a primeira lei da termodinâmica.', 'A variação da energia interna de um sistema é igual ao calor recebido menos o trabalho realizado: ΔU = Q − W.', false, 1],
      ['O que é um processo adiabático?', 'Processo sem troca de calor com o ambiente (Q = 0).', false, 1],
      ['O que é um processo isotérmico?', 'Processo a temperatura constante; em gás ideal, ΔU = 0 e Q = W.', false, 1],
      ['Quando o trabalho realizado pelo gás é positivo?', 'Quando o gás se expande (aumenta de volume).', true, 1],
      ['O que é energia interna?', 'Soma das energias cinética e potencial das partículas do sistema.', false, 1]
    ]
  },
  anki: {
    name: 'Vocabulário de espanhol',
    categoryId: 'idiomas',
    tags: ['espanhol', 'vocabulário'],
    difficulty: 'facil',
    cards: [
      ["O que significa 'embarazada'?", 'Grávida (falso cognato de embaraçada).', false, null],
      ["O que significa 'exquisito'?", 'Delicioso, requintado.', false, null],
      ["O que significa 'oficina'?", 'Escritório.', false, null],
      ["O que significa 'largo'?", 'Comprido, longo.', true, null],
      ["O que significa 'rato'?", 'Um momento, um instante.', false, null],
      ["O que significa 'pelado'?", 'Careca.', false, null]
    ]
  }
}

function buildResult(job) {
  const sample = SAMPLES[job.source] || SAMPLES.text
  const name = job.source === 'text' && job.textPreview ? job.textPreview.split(/[.\n]/)[0].trim().slice(0, 48) || sample.name : sample.name
  return {
    suggested: { name, categoryId: sample.categoryId, tags: sample.tags, difficulty: sample.difficulty },
    cards: sample.cards.map(([front, back, uncertain, page], i) => ({
      tempId: `${job.id}_t${i + 1}`,
      type: 'text',
      front,
      back,
      uncertain,
      origin: { document: job.documentName, page, excerpt: uncertain ? 'Trecho parcialmente ilegível na leitura' : front.slice(0, 40), model: 'claude-sonnet-5', reader: job.source === 'anki' ? 'revisão automática' : 'gemini-3.8-flash', promptVersion: 'v1.3' }
    })),
    filters: { output: { emptyCards: 0, wrongLanguage: 0, likelyHallucination: sample.cards.filter((c) => c[2]).length } }
  }
}

function startTimeline(store, jobId) {
  const state = store.state
  const job = state.generation.jobs.find((j) => j.id === jobId)
  if (!job) return
  const premium = job.plan === 'premium'
  job.status = 'na_fila'
  job.queuePosition = premium ? 1 : 3
  job.attempt = (job.attempt || 0) + 1
  const step = (ms, fn) => store.later(() => {
    const current = store.state.generation.jobs.find((j) => j.id === jobId)
    if (!current || current.cancelled) return
    fn(current)
  }, ms)

  if (job.scenario === 'fail') {
    step(1500, (j) => { j.status = 'lendo'; j.queuePosition = 1 })
    step(3000, (j) => { j.status = 'tentando_novamente'; j.attempt = 2; j.retryInSec = 4 })
    step(4500, (j) => { j.status = 'tentando_novamente'; j.attempt = 3; j.retryInSec = 8 })
    step(6000, (j) => {
      j.status = 'falhou'
      j.deadLetter = true
      j.opsAlerted = true
      j.failedAt = nowIso()
      const quota = store.state.generation.quota[j.userId]
      if (quota && !j.quotaRefunded) { quota.used = Math.max(0, quota.used - 1); j.quotaRefunded = true }
      appendAudit(store.state, { actor: 'system', actorRole: 'pipeline', action: 'generation_failed', target: j.id, details: { attempts: 3, quotaRefunded: true } })
    })
    return
  }

  step(600, (j) => { j.status = 'lendo'; j.queuePosition = premium ? 1 : 2; j.readerModel = j.legibility === 'ilegivel' ? 'gemini-pro (fallback)' : 'gemini-3.8-flash' })
  step(2600, (j) => { j.status = 'gerando'; j.queuePosition = 1; j.generatorModel = 'claude-sonnet-5 · esforço alto' })
  step(6000, (j) => {
    j.status = 'pronto'
    j.readyAt = nowIso()
    j.result = buildResult(j)
  })
}

export function generationRoutes() {
  const r = Router()

  r.get('/generation/quota', requireStudent, (req, res) => {
    const state = req.store.state
    ensureDay(state, req.user.id)
    const q = state.generation.quota[req.user.id]
    const limits = PLAN_LIMITS[req.user.plan]
    res.json({ used: q.used, limit: limits.decksPerDay, plan: req.user.plan, tokens: limits.generationTokens, readBudgetTokens: READ_BUDGET_TOKENS, maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE), priority: limits.queuePriority })
  })

  r.get('/generation/jobs', requireStudent, (req, res) => {
    const jobs = req.store.state.generation.jobs.filter((j) => j.userId === req.user.id)
    res.json({ jobs })
  })

  r.post('/generation/jobs', requireStudent, (req, res) => {
    const state = req.store.state
    ensureDay(state, req.user.id)
    const key = req.get('Idempotency-Key')
    if (key && state.generation.idempotency[key]) {
      const existing = state.generation.jobs.find((j) => j.id === state.generation.idempotency[key].jobId)
      if (existing) return res.json({ job: existing, duplicate: true })
    }
    const { source = 'file', documentName, sizeTokens = 8000, text = '', scenario = null, legibility = 'ok' } = req.body || {}
    if (!['camera', 'file', 'text', 'anki', 'empty'].includes(source)) return fail(res, 422, 'validation', 'Origem inválida.')
    if (source === 'text' && !text.trim()) return fail(res, 422, 'validation', 'Cole um texto para gerar os cards.')
    if (/\bcpf\b|\bsenha\b|\brg\b\s*\d/i.test(text)) return fail(res, 422, 'content_filtered', 'O texto parece conter dados pessoais de terceiros. Remova-os antes de gerar.', { filter: 'pii' })

    const limits = PLAN_LIMITS[req.user.plan]
    const quota = state.generation.quota[req.user.id]
    if (quota.used >= limits.decksPerDay) {
      return fail(res, 429, 'daily_limit', `Você já criou ${limits.decksPerDay} decks hoje.`, { used: quota.used, limit: limits.decksPerDay, plan: req.user.plan, upsell: req.user.plan === 'free', premiumLimit: PLAN_LIMITS.premium.decksPerDay })
    }

    const job = {
      id: id('job'),
      userId: req.user.id,
      plan: req.user.plan,
      source,
      documentName: documentName || (source === 'text' ? 'Texto colado' : source === 'camera' ? 'Foto da câmera' : source === 'anki' ? 'baralho.apkg' : 'documento.pdf'),
      textPreview: text.slice(0, 200),
      sizeTokens,
      pages: Math.max(1, Math.round(sizeTokens / TOKENS_PER_PAGE)),
      scenario,
      legibility,
      idempotencyKey: key || null,
      createdAt: nowIso(),
      status: 'criado',
      queuePosition: null,
      attempt: 0,
      tokensBudget: limits.generationTokens,
      result: null,
      approvedDeckId: null
    }
    state.generation.jobs.unshift(job)
    if (key) state.generation.idempotency[key] = { jobId: job.id, expiresAt: hoursFromNow(24) }
    if (source !== 'empty') quota.used += 1
    else job.quotaRefunded = true

    if (sizeTokens > READ_BUDGET_TOKENS) {
      job.status = 'acima_do_orcamento'
      job.overBudget = { sizeTokens, budgetTokens: READ_BUDGET_TOKENS, pages: job.pages, maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE) }
      return res.status(201).json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
    }
    if (source === 'empty') {
      job.status = 'pronto'
      job.result = { suggested: { name: documentName || 'Novo deck', categoryId: 'outros', tags: [], difficulty: 'medio' }, cards: [], filters: null }
      return res.status(201).json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
    }
    startTimeline(req.store, job.id)
    res.status(201).json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
  })

  r.get('/generation/jobs/:id', requireStudent, (req, res) => {
    const job = req.store.state.generation.jobs.find((j) => j.id === req.params.id && j.userId === req.user.id)
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    res.json({ job })
  })

  r.post('/generation/jobs/:id/scope', requireStudent, (req, res) => {
    const job = req.store.state.generation.jobs.find((j) => j.id === req.params.id && j.userId === req.user.id)
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (job.status !== 'acima_do_orcamento') return fail(res, 409, 'invalid_state', 'Este job não está aguardando escolha de páginas.')
    const { pages, split } = req.body || {}
    if (split) {
      job.splitInto = Math.ceil(job.sizeTokens / READ_BUDGET_TOKENS)
      job.scope = { mode: 'dividir', parts: job.splitInto }
    } else if (Array.isArray(pages) && pages.length === 2) {
      const [from, to] = pages.map(Number)
      if (!(from >= 1 && to >= from) || (to - from + 1) * TOKENS_PER_PAGE > READ_BUDGET_TOKENS) return fail(res, 422, 'validation', 'Escolha um intervalo dentro do orçamento (até 750 páginas).')
      job.scope = { mode: 'paginas', from, to }
    } else {
      return fail(res, 422, 'validation', 'Escolha páginas ou divida em vários decks.')
    }
    job.overBudget = null
    startTimeline(req.store, job.id)
    res.json({ job })
  })

  r.post('/generation/jobs/:id/retry', requireStudent, (req, res) => {
    const state = req.store.state
    const job = state.generation.jobs.find((j) => j.id === req.params.id && j.userId === req.user.id)
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (job.status !== 'falhou') return fail(res, 409, 'invalid_state', 'Só é possível tentar de novo após uma falha.')
    const limits = PLAN_LIMITS[req.user.plan]
    const quota = state.generation.quota[req.user.id]
    if (quota.used >= limits.decksPerDay) return fail(res, 429, 'daily_limit', 'Limite diário atingido.', { used: quota.used, limit: limits.decksPerDay, plan: req.user.plan, upsell: req.user.plan === 'free' })
    quota.used += 1
    job.quotaRefunded = false
    job.scenario = null
    job.deadLetter = false
    startTimeline(req.store, job.id)
    res.json({ job })
  })

  r.post('/generation/jobs/:id/cancel', requireStudent, (req, res) => {
    const state = req.store.state
    const job = state.generation.jobs.find((j) => j.id === req.params.id && j.userId === req.user.id)
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    job.cancelled = true
    job.status = 'cancelado'
    const quota = state.generation.quota[req.user.id]
    if (!job.quotaRefunded) { quota.used = Math.max(0, quota.used - 1); job.quotaRefunded = true }
    res.json({ job })
  })

  r.post('/generation/jobs/:id/approve', requireStudent, (req, res) => {
    const state = req.store.state
    const job = state.generation.jobs.find((j) => j.id === req.params.id && j.userId === req.user.id)
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (job.status !== 'pronto') return fail(res, 409, 'invalid_state', 'A geração ainda não terminou.')
    if (job.approvedDeckId) return res.json({ deckId: job.approvedDeckId, duplicate: true })
    const { name, categoryId, tags, difficulty, cards, folderId = null } = req.body || {}
    const suggested = job.result.suggested
    const finalCards = Array.isArray(cards) ? cards : job.result.cards
    const deck = {
      id: id('d'),
      ownerId: req.user.id,
      name: (name || suggested.name).trim(),
      categoryId: categoryId || suggested.categoryId,
      tags: Array.isArray(tags) ? tags : suggested.tags,
      difficulty: difficulty || suggested.difficulty,
      lang: req.user.locale,
      difficult: false,
      focus: false,
      complementary: false,
      pinned: false,
      favorite: false,
      folderId,
      source: { type: job.source, document: job.documentName, pages: job.pages, deleteOriginalAt: job.source === 'anki' ? null : hoursFromNow(24 * 30), keepOriginal: Boolean(req.body?.keepOriginal) },
      createdAt: nowIso(),
      lastStudiedAt: null,
      publication: { status: 'nao_publicado' }
    }
    state.decks.push(deck)
    finalCards.forEach((c, i) => {
      state.cards.push({
        id: id('c'),
        deckId: deck.id,
        type: c.type || 'text',
        front: c.front,
        back: c.back,
        media: c.media || null,
        lang: deck.lang,
        origin: c.origin || { document: job.documentName, page: null, excerpt: null, model: 'claude-sonnet-5', promptVersion: 'v1.3' },
        uncertain: Boolean(c.uncertain) && !c.edited,
        sched: { state: 'new', stability: 0, difficulty: 5, due: nowIso(), lastReview: null, reps: 0, lapses: 0, consecutiveLapses: 0 },
        order: i
      })
    })
    job.status = 'aprovado'
    job.approvedDeckId = deck.id
    req.user.publicProfile.cardsGenerated = (req.user.publicProfile.cardsGenerated || 0) + finalCards.length
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'deck_created_from_generation', target: deck.id, details: { jobId: job.id, cards: finalCards.length, source: job.source } })
    res.status(201).json({ deckId: deck.id, deck, cards: finalCards.length })
  })

  return r
}
