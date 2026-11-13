import { PLAN_LIMITS } from '../lib/helpers.js'
import { dayKey, hoursFromNow, id, nowIso } from '../lib/ids.js'
import { CATEGORY_MAP } from './decks.repo.js'
import { mapDeckRow, mapGenerationJobRow } from './mappers.js'
import { createServiceClient } from './supabase.js'

export const TOKENS_PER_PAGE = 267
export const READ_BUDGET_TOKENS = 200000

const DETERMINISTIC_SAMPLES = {
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

export function isDeterministicFallbackAllowed() {
  return (
    process.env.NODE_ENV === 'test' &&
    process.env.ALLOW_DETERMINISTIC_AI_FALLBACK === 'true'
  )
}

export function buildDeterministicResult(job) {
  const sample = DETERMINISTIC_SAMPLES[job.source] || DETERMINISTIC_SAMPLES.text
  const preview = job.textPreview ?? job.text_preview ?? ''
  const docName = job.documentName ?? job.document_name ?? 'documento.pdf'
  const name =
    job.source === 'text' && preview
      ? preview.split(/[.\n]/)[0].trim().slice(0, 48) || sample.name
      : sample.name
  return {
    suggested: {
      name,
      categoryId: sample.categoryId,
      tags: sample.tags,
      difficulty: sample.difficulty
    },
    cards: sample.cards.map(([front, back, uncertain, page], i) => ({
      tempId: `${job.id}_t${i + 1}`,
      type: 'text',
      front,
      back,
      uncertain,
      origin: {
        document: docName,
        page,
        excerpt: uncertain
          ? 'Trecho parcialmente ilegível na leitura'
          : front.slice(0, 40),
        model: 'deterministic-test-fallback',
        reader: job.source === 'anki' ? 'revisão automática' : 'deterministic-test-reader',
        promptVersion: 'v1.3'
      }
    })),
    filters: {
      output: {
        emptyCards: 0,
        wrongLanguage: 0,
        likelyHallucination: sample.cards.filter((c) => c[2]).length
      }
    }
  }
}

export function createGenerationRepo({ serviceClient = null } = {}) {
  const getService = () => serviceClient || createServiceClient()

  async function getUsageRow(db, userId, today) {
    const { data, error } = await db
      .from('generation_daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('day_key', today)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async function setDailyUsed(userId, today, nextUsed) {
    const admin = getService()
    const safeUsed = Math.max(0, Number(nextUsed))
    const { data: existing, error: selErr } = await admin
      .from('generation_daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('day_key', today)
      .maybeSingle()
    if (selErr) throw selErr

    if (existing) {
      const { error: updErr } = await admin
        .from('generation_daily_usage')
        .update({ used: safeUsed, updated_at: nowIso() })
        .eq('user_id', userId)
        .eq('day_key', today)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await admin
        .from('generation_daily_usage')
        .insert({ user_id: userId, day_key: today, used: safeUsed })
      if (insErr) throw insErr
    }
    return safeUsed
  }

  async function executeJobNow(
    db,
    user,
    jobRow,
    { aiGenerator = null, auditRepo = null, scenario = null, today }
  ) {
    if (scenario === 'fail') {
      const currentUsage = await getUsageRow(db, user.id, today)
      const refundedUsed = Math.max(0, Number(currentUsage?.used ?? 1) - 1)
      await setDailyUsed(user.id, today, refundedUsed)

      const failedPatch = {
        status: 'falhou',
        attempt: 3,
        failed_at: nowIso(),
        quota_refunded: true
      }
      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update(failedPatch)
        .eq('id', jobRow.id)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      if (auditRepo) {
        await auditRepo.append({
          actor: 'system',
          actorRole: 'pipeline',
          action: 'generation_failed',
          target: jobRow.id,
          details: { attempts: 3, quotaRefunded: true }
        })
      }
      return mapGenerationJobRow(updated || { ...jobRow, ...failedPatch })
    }

    if (typeof aiGenerator === 'function') {
      const generated = await aiGenerator(mapGenerationJobRow(jobRow), user)
      const readyPatch = {
        status: 'pronto',
        ready_at: nowIso(),
        reader_model: generated.readerModel || 'gemini-2.5-flash',
        generator_model: generated.generatorModel || 'gemini-2.5-flash',
        result: generated.result || generated
      }
      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update(readyPatch)
        .eq('id', jobRow.id)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr
      return mapGenerationJobRow(updated || { ...jobRow, ...readyPatch })
    }

    if (isDeterministicFallbackAllowed()) {
      const result = buildDeterministicResult(jobRow)
      const readyPatch = {
        status: 'pronto',
        ready_at: nowIso(),
        reader_model:
          jobRow.legibility === 'ilegivel'
            ? 'gemini-pro (fallback)'
            : 'deterministic-test-reader',
        generator_model: 'deterministic-test-fallback',
        result
      }
      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update(readyPatch)
        .eq('id', jobRow.id)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr
      return mapGenerationJobRow(updated || { ...jobRow, ...readyPatch })
    }

    const currentUsage = await getUsageRow(db, user.id, today)
    const refundedUsed = Math.max(0, Number(currentUsage?.used ?? 1) - 1)
    await setDailyUsed(user.id, today, refundedUsed)

    const unconfiguredPatch = {
      status: 'falhou',
      failed_at: nowIso(),
      quota_refunded: true
    }
    await db
      .from('generation_jobs')
      .update(unconfiguredPatch)
      .eq('id', jobRow.id)
      .eq('user_id', user.id)

    const err = new Error('Provedor de IA não configurado para geração de cards.')
    err.code = 'ai_unavailable'
    err.status = 503
    throw err
  }

  return {
    async getQuota(db, user) {
      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const plan = user.plan || 'free'
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free
      const usageRow = await getUsageRow(db, user.id, today)
      const used = Number(usageRow?.used ?? 0)
      return {
        used,
        limit: limits.decksPerDay,
        plan,
        tokens: limits.generationTokens,
        readBudgetTokens: READ_BUDGET_TOKENS,
        maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE),
        priority: limits.queuePriority,
        dayKey: today
      }
    },

    async listJobs(db, user) {
      const { data, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []).map(mapGenerationJobRow)
    },

    async getJob(db, user, jobId) {
      const { data, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return mapGenerationJobRow(data)
    },

    async createJob(
      db,
      user,
      body = {},
      idempotencyKey = null,
      { aiGenerator = null, auditRepo = null } = {}
    ) {
      if (idempotencyKey) {
        const { data: existing, error: idemErr } = await db
          .from('generation_jobs')
          .select('*')
          .eq('user_id', user.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()
        if (idemErr) throw idemErr
        if (existing) {
          return { job: mapGenerationJobRow(existing), duplicate: true }
        }
      }

      const {
        source = 'file',
        documentName,
        sizeTokens = 8000,
        text = '',
        scenario = null,
        legibility = 'ok',
        storagePath = null
      } = body

      const quota = await this.getQuota(db, user)
      if (quota.used >= quota.limit) {
        return {
          quotaExceeded: {
            used: quota.used,
            limit: quota.limit,
            plan: quota.plan,
            upsell: quota.plan === 'free',
            premiumLimit: PLAN_LIMITS.premium.decksPerDay
          }
        }
      }

      const pages = Math.max(1, Math.round(Number(sizeTokens) / TOKENS_PER_PAGE))
      const resolvedDocName =
        documentName ||
        (source === 'text'
          ? 'Texto colado'
          : source === 'camera'
            ? 'Foto da câmera'
            : source === 'anki'
              ? 'baralho.apkg'
              : 'documento.pdf')

      let nextUsed = quota.used
      if (source !== 'empty') {
        nextUsed = await setDailyUsed(user.id, quota.dayKey, quota.used + 1)
      }

      const overBudget =
        Number(sizeTokens) > READ_BUDGET_TOKENS
          ? {
              sizeTokens: Number(sizeTokens),
              budgetTokens: READ_BUDGET_TOKENS,
              pages,
              maxPages: Math.round(READ_BUDGET_TOKENS / TOKENS_PER_PAGE)
            }
          : null

      const initialStatus = overBudget
        ? 'acima_do_orcamento'
        : source === 'empty'
          ? 'pronto'
          : 'gerando'

      const emptyResult =
        source === 'empty'
          ? {
              suggested: {
                name: documentName || 'Novo deck',
                categoryId: 'outros',
                tags: [],
                difficulty: 'medio'
              },
              cards: [],
              filters: null
            }
          : null

      const insertPayload = {
        id: id('job'),
        user_id: user.id,
        idempotency_key: idempotencyKey || null,
        plan: quota.plan,
        source,
        document_name: resolvedDocName,
        storage_path: storagePath,
        text_preview: String(text || '').slice(0, 200),
        text_content: text ? String(text) : null,
        size_tokens: Number(sizeTokens),
        pages,
        legibility,
        status: initialStatus,
        scope: null,
        over_budget: overBudget,
        tokens_budget: quota.tokens,
        attempt: 1,
        quota_refunded: source === 'empty',
        result: emptyResult,
        approved_deck_id: null,
        ready_at: source === 'empty' ? nowIso() : null,
        created_at: nowIso()
      }

      const { data: inserted, error: insErr } = await db
        .from('generation_jobs')
        .insert(insertPayload)
        .select('*')
        .single()
      if (insErr) throw insErr

      if (overBudget || source === 'empty') {
        return {
          job: mapGenerationJobRow(inserted),
          quota: { used: nextUsed, limit: quota.limit }
        }
      }

      const executedJob = await executeJobNow(db, user, inserted, {
        aiGenerator,
        auditRepo,
        scenario,
        today: quota.dayKey
      })

      const finalQuota = await this.getQuota(db, user)
      return {
        job: executedJob,
        quota: { used: finalQuota.used, limit: finalQuota.limit }
      }
    },

    async scopeJob(
      db,
      user,
      jobId,
      { pages, split },
      { aiGenerator = null, auditRepo = null } = {}
    ) {
      const { data: jobRow, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!jobRow) return { notFound: true }
      if (jobRow.status !== 'acima_do_orcamento') return { invalidState: true }

      let scope = null
      if (split) {
        const parts = Math.ceil(Number(jobRow.size_tokens) / READ_BUDGET_TOKENS)
        scope = { mode: 'dividir', parts }
      } else if (Array.isArray(pages) && pages.length === 2) {
        const [from, to] = pages.map(Number)
        if (
          !(from >= 1 && to >= from) ||
          (to - from + 1) * TOKENS_PER_PAGE > READ_BUDGET_TOKENS
        ) {
          return { invalidRange: true }
        }
        scope = { mode: 'paginas', from, to }
      } else {
        return { invalidPayload: true }
      }

      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update({ scope, over_budget: null, status: 'gerando' })
        .eq('id', jobId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      const job = await executeJobNow(db, user, updated || { ...jobRow, scope, over_budget: null }, {
        aiGenerator,
        auditRepo,
        scenario: null,
        today
      })
      return { job }
    },

    async retryJob(db, user, jobId, { aiGenerator = null, auditRepo = null } = {}) {
      const { data: jobRow, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!jobRow) return { notFound: true }
      if (jobRow.status !== 'falhou') return { invalidState: true }

      const quota = await this.getQuota(db, user)
      if (quota.used >= quota.limit) {
        return {
          quotaExceeded: {
            used: quota.used,
            limit: quota.limit,
            plan: quota.plan,
            upsell: quota.plan === 'free'
          }
        }
      }

      await setDailyUsed(user.id, quota.dayKey, quota.used + 1)
      const nextAttempt = Number(jobRow.attempt ?? 1) + 1
      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update({
          quota_refunded: false,
          attempt: nextAttempt,
          failed_at: null,
          status: 'gerando'
        })
        .eq('id', jobId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      const job = await executeJobNow(
        db,
        user,
        updated || { ...jobRow, quota_refunded: false, attempt: nextAttempt },
        {
          aiGenerator,
          auditRepo,
          scenario: null,
          today: quota.dayKey
        }
      )
      return { job }
    },

    async cancelJob(db, user, jobId) {
      const { data: jobRow, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!jobRow) return null

      const tz = user.timezone || 'America/Sao_Paulo'
      const today = dayKey(nowIso(), tz)
      let quotaRefunded = Boolean(jobRow.quota_refunded)
      if (!quotaRefunded && jobRow.source !== 'empty') {
        const usageRow = await getUsageRow(db, user.id, today)
        const nextUsed = Math.max(0, Number(usageRow?.used ?? 1) - 1)
        await setDailyUsed(user.id, today, nextUsed)
        quotaRefunded = true
      }

      const { data: updated, error: updErr } = await db
        .from('generation_jobs')
        .update({ status: 'cancelado', quota_refunded: quotaRefunded })
        .eq('id', jobId)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle()
      if (updErr) throw updErr

      return mapGenerationJobRow(
        updated || { ...jobRow, status: 'cancelado', quota_refunded: quotaRefunded }
      )
    },

    async approveJob(db, user, jobId, body = {}, auditRepo = null) {
      const { data: jobRow, error } = await db
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!jobRow) return { notFound: true }
      if (jobRow.status !== 'pronto') return { invalidState: true }
      const existingDeckId = jobRow.approved_deck_id ?? jobRow.approvedDeckId
      if (existingDeckId) {
        return { deckId: existingDeckId, duplicate: true }
      }

      const job = mapGenerationJobRow(jobRow)
      const { name, categoryId, tags, difficulty, cards, folderId = null, keepOriginal = false } = body
      const suggested = job.result?.suggested || {
        name: job.documentName,
        categoryId: 'outros',
        tags: [],
        difficulty: 'medio'
      }
      const finalCards = Array.isArray(cards) ? cards : job.result?.cards || []

      const deckPayload = {
        id: id('d'),
        owner_id: user.id,
        folder_id: folderId,
        name: String(name || suggested.name).trim(),
        category_id: categoryId || suggested.categoryId || 'outros',
        tags: Array.isArray(tags) ? tags : suggested.tags || [],
        difficulty: difficulty || suggested.difficulty || 'medio',
        lang: user.locale || 'pt-BR',
        scheduled: true,
        difficult: false,
        focus: false,
        complementary: false,
        pinned: false,
        favorite: false,
        source: {
          type: job.source,
          document: job.documentName,
          pages: job.pages,
          deleteOriginalAt: job.source === 'anki' ? null : hoursFromNow(24 * 30),
          keepOriginal: Boolean(keepOriginal)
        },
        publication_meta: { status: 'nao_publicado' },
        created_at: nowIso()
      }

      const { data: insertedDeck, error: deckErr } = await db
        .from('decks')
        .insert(deckPayload)
        .select('*')
        .single()
      if (deckErr) throw deckErr

      const createdCards = []
      if (finalCards.length > 0) {
        const cardRows = finalCards.map((c, idx) => ({
          id: id('c'),
          deck_id: insertedDeck.id,
          owner_id: user.id,
          type: c.type || 'text',
          front: String(c.front || '').trim(),
          back: String(c.back || '').trim(),
          media: c.media || null,
          lang: deckPayload.lang,
          origin: c.origin || {
            document: job.documentName,
            page: null,
            excerpt: null,
            model: job.generatorModel || 'gemini-2.5-flash',
            promptVersion: 'v1.3'
          },
          uncertain: Boolean(c.uncertain) && !c.edited,
          position: idx,
          sched_state: 'new',
          sched_stability: 0,
          sched_difficulty: 5,
          sched_due: nowIso(),
          sched_last_review: null,
          sched_reps: 0,
          sched_lapses: 0,
          sched_consecutive_lapses: 0,
          created_at: nowIso()
        }))
        const { data: insCards, error: cardsErr } = await db
          .from('cards')
          .insert(cardRows)
          .select('*')
        if (cardsErr) throw cardsErr
        createdCards.push(...(insCards || cardRows))
      }

      const { error: updJobErr } = await db
        .from('generation_jobs')
        .update({ status: 'aprovado', approved_deck_id: insertedDeck.id })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (updJobErr) throw updJobErr

      const admin = getService()
      const nextPublicProfile = {
        ...(user.publicProfile || {}),
        cardsGenerated: Number(user.publicProfile?.cardsGenerated ?? 0) + finalCards.length
      }
      await admin
        .from('profiles')
        .update({ public_profile: nextPublicProfile })
        .eq('id', user.id)

      if (auditRepo) {
        await auditRepo.append({
          actor: user.id,
          actorRole: 'student',
          action: 'deck_created_from_generation',
          target: insertedDeck.id,
          details: { jobId: job.id, cards: finalCards.length, source: job.source }
        })
      }

      return {
        deckId: insertedDeck.id,
        deck: mapDeckRow(insertedDeck, createdCards, CATEGORY_MAP),
        cards: finalCards.length
      }
    }
  }
}
