import { Router } from 'express'
import {
  buildDeterministicResult,
  isDeterministicFallbackAllowed,
  MAX_PDF_PAGES,
  READ_BUDGET_TOKENS,
  TOKENS_PER_PAGE
} from '../data/generation.repo.js'
import { appendAudit } from '../lib/audit.js'
import { requireStudent } from '../lib/auth.js'
import { generateFlashcardsWithGemini, isGeminiConfigured } from '../lib/gemini.js'
import { ensureDay, fail, PLAN_LIMITS } from '../lib/helpers.js'
import { hoursFromNow, id, nowIso } from '../lib/ids.js'
import { rateLimit } from '../lib/rateLimit.js'

const aiGenerationLimiter = rateLimit({
  scope: 'ai',
  maxHits: 10,
  windowSeconds: 60,
  keyFrom: (req) => req.user?.id || req.ip || 'local',
  message: 'Muitas solicitações de geração em pouco tempo. Aguarde um minuto e tente novamente.'
})

async function executeStoreJob(state, job, req) {
  job.attempt = (job.attempt || 0) + 1
  if (job.scenario === 'fail') {
    job.status = 'falhou'
    job.deadLetter = true
    job.opsAlerted = true
    job.failedAt = nowIso()
    const quota = state.generation.quota[job.userId]
    if (quota && !job.quotaRefunded) {
      quota.used = Math.max(0, quota.used - 1)
      job.quotaRefunded = true
    }
    appendAudit(state, {
      actor: 'system',
      actorRole: 'pipeline',
      action: 'generation_failed',
      target: job.id,
      details: { attempts: 3, quotaRefunded: true }
    })
    return job
  }

  if (typeof req.aiGenerator === 'function' || isGeminiConfigured()) {
    try {
      const generated =
        typeof req.aiGenerator === 'function'
          ? await req.aiGenerator(job, req.user)
          : await generateFlashcardsWithGemini(job, req.user)
      job.status = 'pronto'
      job.readyAt = nowIso()
      job.pages = Number(generated.pages || job.pages || 1)
      job.readerModel = generated.readerModel || 'gemini-2.5-flash'
      job.generatorModel = generated.generatorModel || 'gemini-2.5-flash'
      job.result = generated.result || generated
      return job
    } catch (err) {
      job.status = 'falhou'
      job.failedAt = nowIso()
      const quota = state.generation.quota[job.userId]
      if (quota && !job.quotaRefunded) {
        quota.used = Math.max(0, quota.used - 1)
        job.quotaRefunded = true
      }
      appendAudit(state, {
        actor: 'system',
        actorRole: 'pipeline',
        action: 'generation_failed',
        target: job.id,
        details: { attempts: job.attempt, quotaRefunded: true, errorCode: err?.code || 'ai_error' }
      })
      if (err?.code === 'pdf_page_limit' || err?.code === 'forbidden') {
        throw err
      }
      return job
    }
  }

  if (isDeterministicFallbackAllowed()) {
    job.status = 'pronto'
    job.readyAt = nowIso()
    job.readerModel =
      job.legibility === 'ilegivel'
        ? 'gemini-pro (fallback)'
        : 'deterministic-test-reader'
    job.generatorModel = 'deterministic-test-fallback'
    job.result = buildDeterministicResult(job)
    return job
  }

  job.status = 'falhou'
  job.failedAt = nowIso()
  const quota = state.generation.quota[job.userId]
  if (quota && !job.quotaRefunded) {
    quota.used = Math.max(0, quota.used - 1)
    job.quotaRefunded = true
  }
  const err = new Error('Provedor de IA não configurado para geração de cards.')
  err.code = 'ai_unavailable'
  err.status = 503
  throw err
}

export function generationRoutes() {
  const r = Router()

  r.get('/generation/quota', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const quota = await req.data.generation.getQuota(req.db, req.user)
      const { dayKey: _d, ...publicQuota } = quota
      return res.json(publicQuota)
    }
    const state = req.store.state
    ensureDay(state, req.user.id)
    const q = state.generation.quota[req.user.id]
    const limits = PLAN_LIMITS[req.user.plan]
    res.json({
      used: q.used,
      limit: limits.decksPerDay,
      plan: req.user.plan,
      tokens: limits.generationTokens,
      readBudgetTokens: READ_BUDGET_TOKENS,
      maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE),
      maxPdfPages: MAX_PDF_PAGES,
      priority: limits.queuePriority
    })
  })

  r.get('/generation/jobs', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const jobs = await req.data.generation.listJobs(req.db, req.user)
      return res.json({ jobs })
    }
    const jobs = req.store.state.generation.jobs.filter((j) => j.userId === req.user.id)
    res.json({ jobs })
  })

  r.post('/generation/jobs', requireStudent, aiGenerationLimiter, async (req, res) => {
    const {
      source: rawSource = 'file',
      documentName,
      sizeTokens = 8000,
      pages: explicitPages = null,
      text = '',
      scenario = null,
      legibility = 'ok',
      storagePath = null,
      defer = null
    } = req.body || {}
    if (!['camera', 'file', 'text', 'topic', 'anki', 'empty'].includes(rawSource)) {
      return fail(res, 422, 'validation', 'Origem inválida.')
    }
    const source = rawSource === 'topic' ? 'text' : rawSource
    if (source === 'text' && !text.trim()) {
      return fail(
        res,
        422,
        'validation',
        rawSource === 'topic'
          ? 'Digite um tema para gerar os cards.'
          : 'Cole um texto para gerar os cards.'
      )
    }
    if (/\bcpf\b|\bsenha\b|\brg\b\s*\d/i.test(text)) {
      return fail(
        res,
        422,
        'content_filtered',
        'O texto parece conter dados pessoais de terceiros. Remova-os antes de gerar.',
        { filter: 'pii' }
      )
    }
    if (
      source === 'file' &&
      Number(sizeTokens) <= READ_BUDGET_TOKENS &&
      Number(explicitPages) > MAX_PDF_PAGES
    ) {
      return fail(
        res,
        422,
        'pdf_page_limit',
        'O limite para PDF é de até 50 páginas.',
        { pages: Number(explicitPages), maxPages: MAX_PDF_PAGES }
      )
    }

    const key = req.get('Idempotency-Key')

    if (req.useSupabase && req.db) {
      try {
        const created = await req.data.generation.createJob(
          req.db,
          req.user,
          {
            source: rawSource,
            documentName,
            sizeTokens,
            pages: explicitPages,
            text,
            scenario,
            legibility,
            storagePath,
            defer
          },
          key,
          { aiGenerator: req.aiGenerator, auditRepo: req.data.audit }
        )
        if (created.duplicate) {
          return res.json({ job: created.job, duplicate: true })
        }
        if (created.quotaExceeded) {
          const q = created.quotaExceeded
          return fail(res, 429, 'daily_limit', `Você já criou ${q.limit} decks hoje.`, q)
        }
        return res.status(201).json(created)
      } catch (err) {
        if (err?.code === 'pdf_page_limit' || err?.code === 'forbidden') {
          return fail(res, err.status || 422, err.code, err.message, err.details || null)
        }
        throw err
      }
    }

    const state = req.store.state
    ensureDay(state, req.user.id)
    if (key && state.generation.idempotency[key]) {
      const existing = state.generation.jobs.find(
        (j) => j.id === state.generation.idempotency[key].jobId
      )
      if (existing) return res.json({ job: existing, duplicate: true })
    }

    const limits = PLAN_LIMITS[req.user.plan]
    const quota = state.generation.quota[req.user.id]
    if (quota.used >= limits.decksPerDay) {
      return fail(
        res,
        429,
        'daily_limit',
        `Você já criou ${limits.decksPerDay} decks hoje.`,
        {
          used: quota.used,
          limit: limits.decksPerDay,
          plan: req.user.plan,
          upsell: req.user.plan === 'free',
          premiumLimit: PLAN_LIMITS.premium.decksPerDay
        }
      )
    }

    const computedPages =
      Number(explicitPages) >= 1
        ? Math.round(Number(explicitPages))
        : Math.max(1, Math.round(sizeTokens / TOKENS_PER_PAGE))

    const job = {
      id: id('job'),
      userId: req.user.id,
      plan: req.user.plan,
      source,
      documentName:
        documentName ||
        (rawSource === 'topic'
          ? `Tema: ${text.trim().slice(0, 60) || 'Estudo'}`
          : source === 'text'
            ? 'Texto colado'
            : source === 'camera'
              ? 'Foto da câmera'
              : source === 'anki'
                ? 'baralho.apkg'
                : 'documento.pdf'),
      storagePath,
      textPreview: text.slice(0, 200),
      textContent: text || null,
      sizeTokens,
      pages: computedPages,
      scenario,
      legibility,
      idempotencyKey: key || null,
      createdAt: nowIso(),
      status: 'na_fila',
      queuePosition: null,
      attempt: 0,
      tokensBudget: limits.generationTokens,
      result: null,
      approvedDeckId: null
    }
    state.generation.jobs.unshift(job)
    if (key) {
      state.generation.idempotency[key] = { jobId: job.id, expiresAt: hoursFromNow(24) }
    }
    if (source !== 'empty') quota.used += 1
    else job.quotaRefunded = true

    if (sizeTokens > READ_BUDGET_TOKENS) {
      job.status = 'acima_do_orcamento'
      job.overBudget = {
        sizeTokens,
        budgetTokens: READ_BUDGET_TOKENS,
        pages: job.pages,
        maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE)
      }
      return res
        .status(201)
        .json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
    }
    if (source === 'empty') {
      job.status = 'pronto'
      job.result = {
        suggested: {
          name: documentName || 'Novo deck',
          categoryId: 'outros',
          tags: [],
          difficulty: 'medio'
        },
        cards: [],
        filters: null
      }
      return res
        .status(201)
        .json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
    }

    const shouldDeferToPolling =
      scenario !== 'fail' && (defer === true || (defer !== false && isGeminiConfigured()))
    if (shouldDeferToPolling) {
      return res
        .status(201)
        .json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
    }

    await executeStoreJob(state, job, req)
    res.status(201).json({ job, quota: { used: quota.used, limit: limits.decksPerDay } })
  })

  r.get('/generation/jobs/:id', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      try {
        const job = await req.data.generation.getJob(req.db, req.user, req.params.id, {
          aiGenerator: req.aiGenerator,
          auditRepo: req.data.audit,
          executePending: true
        })
        if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
        return res.json({ job })
      } catch (err) {
        if (err?.code === 'pdf_page_limit' || err?.code === 'forbidden') {
          return fail(res, err.status || 422, err.code, err.message, err.details || null)
        }
        throw err
      }
    }
    const job = req.store.state.generation.jobs.find(
      (j) => j.id === req.params.id && j.userId === req.user.id
    )
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (['na_fila', 'lendo', 'gerando', 'criado'].includes(job.status)) {
      await executeStoreJob(req.store.state, job, req)
    }
    res.json({ job })
  })

  r.post('/generation/jobs/:id/scope', requireStudent, async (req, res) => {
    const { pages, split } = req.body || {}
    if (req.useSupabase && req.db) {
      const scoped = await req.data.generation.scopeJob(
        req.db,
        req.user,
        req.params.id,
        { pages, split },
        { aiGenerator: req.aiGenerator, auditRepo: req.data.audit }
      )
      if (scoped.notFound) return fail(res, 404, 'not_found', 'Geração não encontrada.')
      if (scoped.invalidState) {
        return fail(
          res,
          409,
          'invalid_state',
          'Este job não está aguardando escolha de páginas.'
        )
      }
      if (scoped.invalidRange) {
        return fail(
          res,
          422,
          'validation',
          'Escolha um intervalo dentro do orçamento (até 750 páginas).'
        )
      }
      if (scoped.invalidPayload) {
        return fail(res, 422, 'validation', 'Escolha páginas ou divida em vários decks.')
      }
      return res.json({ job: scoped.job })
    }

    const job = req.store.state.generation.jobs.find(
      (j) => j.id === req.params.id && j.userId === req.user.id
    )
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (job.status !== 'acima_do_orcamento') {
      return fail(
        res,
        409,
        'invalid_state',
        'Este job não está aguardando escolha de páginas.'
      )
    }
    if (split) {
      job.splitInto = Math.ceil(job.sizeTokens / READ_BUDGET_TOKENS)
      job.scope = { mode: 'dividir', parts: job.splitInto }
    } else if (Array.isArray(pages) && pages.length === 2) {
      const [from, to] = pages.map(Number)
      if (!(from >= 1 && to >= from) || (to - from + 1) * TOKENS_PER_PAGE > READ_BUDGET_TOKENS) {
        return fail(
          res,
          422,
          'validation',
          'Escolha um intervalo dentro do orçamento (até 750 páginas).'
        )
      }
      job.scope = { mode: 'paginas', from, to }
    } else {
      return fail(res, 422, 'validation', 'Escolha páginas ou divida em vários decks.')
    }
    job.overBudget = null
    await executeStoreJob(req.store.state, job, req)
    res.json({ job })
  })

  r.post('/generation/jobs/:id/retry', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const retried = await req.data.generation.retryJob(req.db, req.user, req.params.id, {
        aiGenerator: req.aiGenerator,
        auditRepo: req.data.audit
      })
      if (retried.notFound) return fail(res, 404, 'not_found', 'Geração não encontrada.')
      if (retried.invalidState) {
        return fail(
          res,
          409,
          'invalid_state',
          'Só é possível tentar de novo após uma falha.'
        )
      }
      if (retried.quotaExceeded) {
        return fail(
          res,
          429,
          'daily_limit',
          'Limite diário atingido.',
          retried.quotaExceeded
        )
      }
      return res.json({ job: retried.job })
    }

    const state = req.store.state
    const job = state.generation.jobs.find(
      (j) => j.id === req.params.id && j.userId === req.user.id
    )
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (job.status !== 'falhou') {
      return fail(res, 409, 'invalid_state', 'Só é possível tentar de novo após uma falha.')
    }
    const limits = PLAN_LIMITS[req.user.plan]
    const quota = state.generation.quota[req.user.id]
    if (quota.used >= limits.decksPerDay) {
      return fail(res, 429, 'daily_limit', 'Limite diário atingido.', {
        used: quota.used,
        limit: limits.decksPerDay,
        plan: req.user.plan,
        upsell: req.user.plan === 'free'
      })
    }
    quota.used += 1
    job.quotaRefunded = false
    job.scenario = null
    job.deadLetter = false
    await executeStoreJob(state, job, req)
    res.json({ job })
  })

  r.post('/generation/jobs/:id/cancel', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const job = await req.data.generation.cancelJob(req.db, req.user, req.params.id)
      if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
      return res.json({ job })
    }
    const state = req.store.state
    const job = state.generation.jobs.find(
      (j) => j.id === req.params.id && j.userId === req.user.id
    )
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    job.cancelled = true
    job.status = 'cancelado'
    const quota = state.generation.quota[req.user.id]
    if (!job.quotaRefunded) {
      quota.used = Math.max(0, quota.used - 1)
      job.quotaRefunded = true
    }
    res.json({ job })
  })

  r.post('/generation/jobs/:id/approve', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const approved = await req.data.generation.approveJob(
        req.db,
        req.user,
        req.params.id,
        req.body || {},
        req.data.audit,
        { aiGenerator: req.aiGenerator }
      )
      if (approved.notFound) return fail(res, 404, 'not_found', 'Geração não encontrada.')
      if (approved.invalidState) {
        return fail(res, 409, 'invalid_state', 'A geração ainda não terminou.')
      }
      if (approved.duplicate) {
        return res.json({ deckId: approved.deckId, duplicate: true })
      }
      return res.status(201).json(approved)
    }

    const state = req.store.state
    const job = state.generation.jobs.find(
      (j) => j.id === req.params.id && j.userId === req.user.id
    )
    if (!job) return fail(res, 404, 'not_found', 'Geração não encontrada.')
    if (['na_fila', 'lendo', 'gerando', 'criado'].includes(job.status)) {
      await executeStoreJob(state, job, req)
    }
    if (job.status !== 'pronto') {
      return fail(res, 409, 'invalid_state', 'A geração ainda não terminou.')
    }
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
      source: {
        type: job.source,
        document: job.documentName,
        pages: job.pages,
        deleteOriginalAt: job.source === 'anki' ? null : hoursFromNow(24 * 30),
        keepOriginal: Boolean(req.body?.keepOriginal)
      },
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
        origin: c.origin || {
          document: job.documentName,
          page: null,
          excerpt: null,
          model: 'gemini-2.5-flash',
          promptVersion: 'v2.0-gemini-flash'
        },
        uncertain: Boolean(c.uncertain) && !c.edited,
        sched: {
          state: 'new',
          stability: 0,
          difficulty: 5,
          due: nowIso(),
          lastReview: null,
          reps: 0,
          lapses: 0,
          consecutiveLapses: 0
        },
        order: i
      })
    })
    job.status = 'aprovado'
    job.approvedDeckId = deck.id
    req.user.publicProfile.cardsGenerated =
      (req.user.publicProfile.cardsGenerated || 0) + finalCards.length
    appendAudit(state, {
      actor: req.user.id,
      actorRole: 'student',
      action: 'deck_created_from_generation',
      target: deck.id,
      details: { jobId: job.id, cards: finalCards.length, source: job.source }
    })
    res.status(201).json({ deckId: deck.id, deck, cards: finalCards.length })
  })

  return r
}
