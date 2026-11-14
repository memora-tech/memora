export const MAX_PDF_PAGES = 50
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const FALLBACK_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

const ALLOWED_CATEGORIES = [
  'vestibular',
  'concursos',
  'superior',
  'idiomas',
  'tecnologia',
  'saude',
  'direito',
  'negocios',
  'medio',
  'fundamental',
  'certificacoes',
  'cultura',
  'musica',
  'culinaria',
  'outros'
]

const ALLOWED_DIFFICULTIES = ['facil', 'medio', 'dificil']

export const FLASHCARD_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['suggested', 'cards'],
  properties: {
    suggested: {
      type: 'OBJECT',
      required: ['name', 'categoryId', 'tags', 'difficulty'],
      properties: {
        name: { type: 'STRING' },
        categoryId: {
          type: 'STRING',
          enum: ALLOWED_CATEGORIES
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        difficulty: {
          type: 'STRING',
          enum: ALLOWED_DIFFICULTIES
        }
      }
    },
    cards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['front', 'back', 'page', 'excerpt', 'uncertain'],
        properties: {
          front: { type: 'STRING' },
          back: { type: 'STRING' },
          page: { type: 'INTEGER' },
          excerpt: { type: 'STRING' },
          uncertain: { type: 'BOOLEAN' }
        }
      }
    }
  }
}

export function isGeminiConfigured() {
  const hasKey = Boolean(
    process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim()
  )
  if (process.env.NODE_ENV === 'test') {
    return process.env.ENABLE_GEMINI_IN_TEST === 'true' && hasKey
  }
  return hasKey
}

export function resolveGenerationModel(preferred = null) {
  return String(
    preferred || process.env.GEMINI_MODEL_GENERATION || DEFAULT_GEMINI_MODEL
  ).trim()
}

export function resolveChatModel(preferred = null) {
  return String(
    preferred ||
      process.env.GEMINI_MODEL_CHAT ||
      process.env.GEMINI_MODEL_GENERATION ||
      DEFAULT_GEMINI_MODEL
  ).trim()
}

export function countPdfPages(input) {
  if (!input) return 0
  let raw = ''
  if (typeof input === 'string') {
    raw = input
  } else if (Buffer.isBuffer(input)) {
    raw = input.toString('latin1')
  } else if (input instanceof ArrayBuffer) {
    raw = Buffer.from(input).toString('latin1')
  } else if (ArrayBuffer.isView(input)) {
    raw = Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString('latin1')
  } else {
    return 0
  }

  const pageMatches = raw.match(/\/Type\s*\/Page(?!s)\b/g)
  const pageCountByType = pageMatches ? pageMatches.length : 0

  let declaredMax = 0
  const pagesNodeRegex = /\/Type\s*\/Pages\b[\s\S]{0,600}?\/Count\s+(\d+)/g
  let match = pagesNodeRegex.exec(raw)
  while (match !== null) {
    const val = Number(match[1])
    if (Number.isFinite(val) && val > declaredMax) {
      declaredMax = val
    }
    match = pagesNodeRegex.exec(raw)
  }

  return pageCountByType > 0 ? pageCountByType : declaredMax
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function callGeminiFlash({
  parts = null,
  contents = null,
  systemInstruction = null,
  responseSchema = null,
  model = null,
  temperature = 0.3,
  maxOutputTokens = 8192,
  timeoutMs = 25000,
  retryDelayMs = 250,
  fetchImpl = globalThis.fetch
}) {
  if (!isGeminiConfigured()) {
    const err = new Error('Provedor de IA não configurado para geração de cards.')
    err.code = 'ai_unavailable'
    err.status = 503
    throw err
  }

  const apiKey = String(process.env.GEMINI_API_KEY).trim()
  const primaryModel = resolveGenerationModel(model)
  const fallbackList = FALLBACK_GEMINI_MODELS.filter((m) => m !== primaryModel)
  const attemptModels = [primaryModel, primaryModel, ...fallbackList]

  let lastError = null

  for (let idx = 0; idx < attemptModels.length; idx += 1) {
    const candidateModel = attemptModels[idx]
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        candidateModel
      )}:generateContent`

      const resolvedContents =
        Array.isArray(contents) && contents.length > 0
          ? contents
          : [
              {
                role: 'user',
                parts: parts || []
              }
            ]

      const payload = {
        ...(systemInstruction
          ? {
              systemInstruction: {
                parts: [{ text: String(systemInstruction) }]
              }
            }
          : {}),
        contents: resolvedContents,
        generationConfig: {
          temperature,
          maxOutputTokens,
          ...(responseSchema
            ? {
                responseMimeType: 'application/json',
                responseSchema
              }
            : {})
        }
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const message =
          errBody?.error?.message ||
          `Falha na chamada ao modelo ${candidateModel} (HTTP ${response.status}).`
        const httpErr = new Error(message)
        httpErr.status = response.status
        httpErr.code =
          response.status === 503 || response.status === 429
            ? 'ai_overloaded'
            : 'ai_generation_failed'
        lastError = httpErr

        const canRetry =
          idx < attemptModels.length - 1 &&
          [404, 408, 429, 500, 502, 503, 504].includes(response.status)
        if (canRetry) {
          if (retryDelayMs > 0) {
            await waitMs(retryDelayMs)
          }
          continue
        }
        throw httpErr
      }

      const data = await response.json()
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || '')
          .join('')
          .trim() || ''

      if (!text) {
        const emptyErr = new Error('O modelo de IA retornou uma resposta vazia.')
        emptyErr.status = 502
        emptyErr.code = 'ai_empty_response'
        throw emptyErr
      }

      return {
        text,
        model: candidateModel,
        usageMetadata: data?.usageMetadata || null
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err?.name === 'AbortError') {
        const timeoutErr = new Error('Tempo limite excedido ao consultar o provedor de IA.')
        timeoutErr.status = 504
        timeoutErr.code = 'ai_timeout'
        lastError = timeoutErr
        if (idx < attemptModels.length - 1) {
          continue
        }
        throw timeoutErr
      }
      lastError = err
      if (
        idx < attemptModels.length - 1 &&
        [404, 408, 429, 500, 502, 503, 504].includes(Number(err?.status))
      ) {
        continue
      }
      throw err
    }
  }

  throw lastError || new Error('Não foi possível gerar os flashcards no momento.')
}

async function toBufferFromStorageData(downloaded) {
  if (!downloaded) return Buffer.alloc(0)
  if (Buffer.isBuffer(downloaded)) return downloaded
  if (downloaded instanceof ArrayBuffer) return Buffer.from(downloaded)
  if (ArrayBuffer.isView(downloaded)) {
    return Buffer.from(downloaded.buffer, downloaded.byteOffset, downloaded.byteLength)
  }
  if (typeof downloaded.arrayBuffer === 'function') {
    const ab = await downloaded.arrayBuffer()
    return Buffer.from(ab)
  }
  if (typeof downloaded === 'string') {
    return Buffer.from(downloaded, 'latin1')
  }
  return Buffer.alloc(0)
}

function normalizeGeneratedResult(parsed, job, usedModel) {
  const docName = job.documentName ?? job.document_name ?? 'Material de estudo'
  const rawSuggested = parsed?.suggested || {}
  const categoryId = ALLOWED_CATEGORIES.includes(rawSuggested.categoryId)
    ? rawSuggested.categoryId
    : 'outros'
  const difficulty = ALLOWED_DIFFICULTIES.includes(rawSuggested.difficulty)
    ? rawSuggested.difficulty
    : 'medio'
  const tags = Array.isArray(rawSuggested.tags)
    ? rawSuggested.tags
        .map((t) => String(t || '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5)
    : []

  const rawCards = Array.isArray(parsed?.cards) ? parsed.cards : []
  let emptyCards = 0
  const validCards = []

  for (let i = 0; i < rawCards.length; i += 1) {
    const item = rawCards[i] || {}
    const front = String(item.front || '').trim()
    const back = String(item.back || '').trim()
    if (!front || !back) {
      emptyCards += 1
      continue
    }
    const uncertain = Boolean(item.uncertain)
    const pageNum = Number(item.page)
    const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.round(pageNum) : 1
    const excerpt = String(item.excerpt || front.slice(0, 80)).trim()

    validCards.push({
      tempId: `${job.id}_t${validCards.length + 1}`,
      type: 'text',
      front,
      back,
      uncertain,
      origin: {
        document: docName,
        page,
        excerpt,
        model: usedModel,
        reader: usedModel,
        promptVersion: 'v2.0-gemini-flash'
      }
    })
  }

  if (validCards.length === 0) {
    const err = new Error('Não foi possível extrair flashcards válidos do material enviado.')
    err.status = 422
    err.code = 'empty_generation_result'
    throw err
  }

  const suggestedName =
    String(rawSuggested.name || '').trim().slice(0, 80) ||
    String(docName).replace(/\.pdf$/i, '').slice(0, 60) ||
    'Novo deck'

  return {
    suggested: {
      name: suggestedName,
      categoryId,
      tags,
      difficulty
    },
    cards: validCards,
    filters: {
      output: {
        emptyCards,
        wrongLanguage: 0,
        likelyHallucination: validCards.filter((c) => c.uncertain).length
      }
    }
  }
}

export async function generateFlashcardsWithGemini(
  job,
  user,
  { serviceClient = null, fetchImpl = globalThis.fetch, retryDelayMs = 250 } = {}
) {
  const source = job.source || 'text'
  const docName = job.documentName ?? job.document_name ?? 'Material de estudo'
  const rawText = String(
    job.textContent ?? job.text_content ?? job.textPreview ?? job.text_preview ?? ''
  ).trim()
  const storagePath = job.storagePath ?? job.storage_path ?? null

  const systemInstruction =
    'Você é a Nôa, tutora pedagógica do Memora. Sua tarefa é criar flashcards objetivos, claros e fiéis ao material de estudo ou tema informado, sempre em português do Brasil (pt-BR). Cada card deve testar um único conceito na frente (pergunta direta) e trazer uma resposta concisa e precisa no verso.'

  const parts = []
  let detectedPages = Number(job.pages ?? 1)

  if (source === 'file') {
    let pdfBuffer = null
    if (Buffer.isBuffer(job.pdfBuffer)) {
      pdfBuffer = job.pdfBuffer
    } else if (typeof job.pdfBase64 === 'string' && job.pdfBase64.trim()) {
      pdfBuffer = Buffer.from(job.pdfBase64.trim(), 'base64')
    } else if (storagePath) {
      const ownerPrefix = `${user.id}/`
      if (!String(storagePath).startsWith(ownerPrefix)) {
        const forbiddenErr = new Error('Caminho de arquivo inválido para este usuário.')
        forbiddenErr.status = 403
        forbiddenErr.code = 'forbidden'
        throw forbiddenErr
      }
      if (!serviceClient?.storage) {
        const storageErr = new Error('Serviço de armazenamento indisponível para leitura do PDF.')
        storageErr.status = 503
        storageErr.code = 'storage_unavailable'
        throw storageErr
      }
      const { data: downloaded, error: dlErr } = await serviceClient.storage
        .from('generation-uploads')
        .download(storagePath)
      if (dlErr || !downloaded) {
        const notFoundErr = new Error('Não foi possível localizar o arquivo PDF enviado.')
        notFoundErr.status = 404
        notFoundErr.code = 'file_not_found'
        throw notFoundErr
      }
      pdfBuffer = await toBufferFromStorageData(downloaded)
    }

    if (pdfBuffer && pdfBuffer.length > 0) {
      const countedPages = countPdfPages(pdfBuffer)
      if (countedPages > 0) {
        detectedPages = countedPages
      }
      if (detectedPages > MAX_PDF_PAGES) {
        const limitErr = new Error('O limite para PDF é de até 50 páginas.')
        limitErr.status = 422
        limitErr.code = 'pdf_page_limit'
        limitErr.details = { pages: detectedPages, maxPages: MAX_PDF_PAGES }
        throw limitErr
      }
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBuffer.toString('base64')
        }
      })
    } else if (Number(job.pages) > MAX_PDF_PAGES) {
      const limitErr = new Error('O limite para PDF é de até 50 páginas.')
      limitErr.status = 422
      limitErr.code = 'pdf_page_limit'
      limitErr.details = { pages: Number(job.pages), maxPages: MAX_PDF_PAGES }
      throw limitErr
    }

    const scopeNote =
      job.scope?.mode === 'paginas'
        ? ` Foque exclusivamente no intervalo da página ${job.scope.from} até a página ${job.scope.to}.`
        : ''

    parts.push({
      text: `Analise o documento "${docName}" e gere entre 8 e 15 flashcards de alta qualidade em português do Brasil (pt-BR) cobrindo os pontos essenciais para revisão espaçada.${scopeNote}${
        rawText ? `\n\nContexto adicional:\n${rawText}` : ''
      }`
    })
  } else {
    const isTopic =
      source === 'topic' ||
      String(docName).startsWith('Tema:') ||
      (rawText.length > 0 && rawText.length <= 160 && !rawText.includes('\n'))

    const promptText = isTopic
      ? `O estudante pediu flashcards sobre o seguinte tema de estudo: "${rawText || docName}". Gere entre 8 e 12 flashcards fundamentais, progressivos e precisos em português do Brasil (pt-BR) sobre esse tema. Use page = 1 e uncertain = false.`
      : `Analise o texto de estudo abaixo ("${docName}") e gere entre 6 e 14 flashcards objetivos em português do Brasil (pt-BR) cobrindo os conceitos principais. Se algum trecho estiver truncado ou ambíguo, marque uncertain = true.\n\nTexto:\n${rawText || docName}`

    parts.push({ text: promptText })
  }

  const response = await callGeminiFlash({
    parts,
    systemInstruction,
    responseSchema: FLASHCARD_RESPONSE_SCHEMA,
    fetchImpl,
    retryDelayMs
  })

  let parsed = null
  try {
    parsed = JSON.parse(response.text)
  } catch {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      const parseErr = new Error('O modelo de IA retornou um formato inválido.')
      parseErr.status = 502
      parseErr.code = 'ai_invalid_json'
      throw parseErr
    }
  }

  const result = normalizeGeneratedResult(parsed, job, response.model)

  return {
    readerModel: response.model,
    generatorModel: response.model,
    pages: detectedPages,
    result
  }
}

export async function generateNoaChatReply({
  message,
  history = [],
  context = {},
  model = null,
  fetchImpl = globalThis.fetch,
  retryDelayMs = 250
}) {
  const studentName = context.userName ? String(context.userName).split(' ')[0] : 'estudante'
  const deckContext = context.deckName ? ` O deck em foco é "${context.deckName}".` : ''

  const systemInstruction = `Você é a Nôa, assistente pedagógica do Memora. Converse com ${studentName} em português do Brasil (pt-BR) de forma acolhedora, direta, clara e didática.${deckContext} Ajude a tirar dúvidas sobre matérias, explicar conceitos passo a passo, criar exemplos práticos de memorização e organizar revisões espaçadas. Mantenha respostas objetivas (até 3 parágrafos curtos) e nunca invente citações ou dados pessoais.`

  const recentHistory = Array.isArray(history) ? history.slice(-10) : []
  const contents = []

  for (const item of recentHistory) {
    const text = String(item?.content || '').trim()
    if (!text) continue
    contents.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }]
    })
  }

  contents.push({
    role: 'user',
    parts: [{ text: String(message || '').trim() }]
  })

  const response = await callGeminiFlash({
    contents,
    systemInstruction,
    model: resolveChatModel(model),
    temperature: 0.4,
    maxOutputTokens: 1024,
    fetchImpl,
    retryDelayMs
  })

  return {
    reply: response.text,
    model: response.model,
    tokens: Number(response.usageMetadata?.totalTokenCount ?? 0)
  }
}
