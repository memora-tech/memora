import { Router } from 'express'
import { FEATURES } from '../config/features.js'
import { isDeterministicFallbackAllowed } from '../data/generation.repo.js'
import { appendAudit } from '../lib/audit.js'
import { requireStudent } from '../lib/auth.js'
import { generateNoaChatReply, isGeminiConfigured } from '../lib/gemini.js'
import { cardsOfDeck, ensureDay, fail, ownDecksOf } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'
import { rateLimit } from '../lib/rateLimit.js'
import { todaySession } from './study.js'

const noaChatLimiter = rateLimit({
  scope: 'ai',
  maxHits: 10,
  windowSeconds: 60,
  keyFrom: (req) => req.user?.id || req.ip || 'local',
  message: 'Muitas mensagens enviadas em pouco tempo. Aguarde um minuto e tente novamente.'
})

export function noaRoutes(features = FEATURES) {
  const r = Router()

  r.get('/noa/catalog', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const catalog = await req.data.noa.getCatalog(req.db, req.user)
      return res.json(catalog)
    }
    const state = req.store.state
    ensureDay(state, req.user.id)
    res.json({
      version: state.noa.catalogVersion,
      actions: state.noa.catalog,
      budget: state.noa.budget[req.user.id],
      signals: [
        'frequência e horário de acesso',
        'acertos e erros',
        'decks usados ou abandonados',
        'streak e Neurônios'
      ],
      neverAlone: [
        'excluir ou alterar dados sem confirmação',
        'notificar fora da janela de silêncio',
        'penalizar reputação, banir ou suspender cupons sem revisão humana',
        'expandir sinais analisados sem aviso'
      ]
    })
  })

  r.get('/noa/overview', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const overview = await req.data.noa.getOverview(
        req.db,
        req.user,
        req.data.study,
        req.data.ledger
      )
      return res.json(overview)
    }
    const state = req.store.state
    ensureDay(state, req.user.id)
    const suggestions = state.noa.suggestions.filter(
      (s) => s.userId === req.user.id && s.status === 'pendente'
    )
    const decisions = state.noa.decisions.filter((d) => d.userId === req.user.id).slice(0, 10)
    const connections = features.mcp
      ? state.mcp.connections.filter((c) => c.userId === req.user.id && !c.revokedAt)
      : []
    const aiSaved = features.mcp
      ? state.mcp.activity.filter((a) => a.userId === req.user.id && a.ok && a.write).length
      : 0
    const today = todaySession(state, req.user.id)
    const own = ownDecksOf(state, req.user.id)
    const weakest =
      own
        .map((d) => {
          const cards = cardsOfDeck(state, d.id)
          return {
            id: d.id,
            name: d.name,
            lapses: cards.reduce((n, c) => n + (c.sched?.lapses || 0), 0),
            weakCards: cards.filter((c) => (c.sched?.lapses || 0) > 0).length
          }
        })
        .filter((d) => d.lapses > 0)
        .sort((a, b) => b.lapses - a.lapses)[0] || null
    const recent = state.reviews.filter((r) => r.userId === req.user.id).slice(-30)
    const accuracy = recent.length
      ? Math.round(
          (recent.filter((r) => r.rating === 'good' || r.rating === 'easy').length /
            recent.length) *
            100
        )
      : null
    const insights = {
      today: {
        cardsDue: today.cardsDue,
        minutes: today.estimatedMinutes,
        decks: today.plan.length,
        status: today.status
      },
      weakest,
      objective: today.nearestObjective
        ? {
            id: today.nearestObjective.id,
            name: today.nearestObjective.name,
            daysLeft: today.nearestObjective.daysLeft
          }
        : null,
      accuracy: accuracy === null ? null : { pct: accuracy, sample: recent.length },
      goal: {
        done: today.doneToday,
        goal: today.goal,
        suggested: today.goalSuggested || null
      },
      streak: today.streak
    }
    res.json({
      insights,
      catalog: state.noa.catalog,
      catalogVersion: state.noa.catalogVersion,
      budget: state.noa.budget[req.user.id],
      suggestions,
      decisions,
      mcp: { connections: connections.length, aiSaved },
      signals: [
        'frequência e horário de acesso',
        'acertos e erros',
        'decks usados ou abandonados',
        'streak e Neurônios'
      ],
      neverAlone: [
        'excluir ou alterar dados sem confirmação',
        'notificar fora da janela de silêncio',
        'penalizar reputação, banir ou suspender cupons sem revisão humana',
        'expandir sinais analisados sem aviso'
      ]
    })
  })

  r.get('/noa/chat', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const data = await req.data.noa.listChatMessages(req.db, req.user)
      return res.json(data)
    }
    const state = req.store.state
    ensureDay(state, req.user.id)
    if (!state.noa.chatMessages) state.noa.chatMessages = []
    const b = state.noa.budget[req.user.id] || {}
    const limit = Number(process.env.NOA_DAILY_CHAT_LIMIT || b.chatLimit || 20)
    const used = Number(b.chatUsed ?? 0)
    const messages = state.noa.chatMessages.filter((m) => m.userId === req.user.id)
    res.json({
      messages,
      budget: { used, limit }
    })
  })

  r.post('/noa/chat', requireStudent, noaChatLimiter, async (req, res) => {
    const rawContent = String(req.body?.message ?? req.body?.text ?? '').trim()
    const deckId = req.body?.deckId || null

    if (!rawContent) {
      return fail(res, 422, 'validation', 'Digite uma mensagem para a Nôa.')
    }
    if (rawContent.length > 2000) {
      return fail(res, 422, 'validation', 'A mensagem pode ter no máximo 2000 caracteres.')
    }
    if (/\bcpf\b|\bsenha\b|\brg\b\s*\d/i.test(rawContent)) {
      return fail(
        res,
        422,
        'content_filtered',
        'A mensagem parece conter dados pessoais de terceiros. Remova-os antes de enviar.',
        { filter: 'pii' }
      )
    }

    if (req.useSupabase && req.db) {
      const sent = await req.data.noa.sendChatMessage(
        req.db,
        req.user,
        { message: rawContent, deckId },
        { aiChatGenerator: req.aiChatGenerator }
      )
      if (sent.limitExceeded) {
        const lim = sent.limitExceeded
        return fail(
          res,
          429,
          'daily_limit',
          `Você atingiu o limite diário de ${lim.limit} mensagens com a Nôa hoje.`,
          lim
        )
      }
      return res.status(201).json(sent)
    }

    const state = req.store.state
    ensureDay(state, req.user.id)
    if (!state.noa.chatMessages) state.noa.chatMessages = []
    if (!state.noa.budget[req.user.id]) {
      state.noa.budget[req.user.id] = {
        suggestionsUsed: 0,
        suggestionsLimit: 5,
        autonomousUsed: 0,
        autonomousLimit: 1,
        chatUsed: 0,
        chatLimit: 20
      }
    }
    const b = state.noa.budget[req.user.id]
    const limit = Number(process.env.NOA_DAILY_CHAT_LIMIT || b.chatLimit || 20)
    const used = Number(b.chatUsed ?? 0)
    if (used >= limit) {
      return fail(
        res,
        429,
        'daily_limit',
        `Você atingiu o limite diário de ${limit} mensagens com a Nôa hoje.`,
        { used, limit }
      )
    }

    const history = state.noa.chatMessages.filter((m) => m.userId === req.user.id).slice(-10)
    let replyText = ''
    let usedModel = 'gemini-2.5-flash'
    let usedTokens = 0

    if (typeof req.aiChatGenerator === 'function') {
      const generated = await req.aiChatGenerator(
        { message: rawContent, history, deckId },
        req.user
      )
      replyText = String(generated?.reply ?? generated?.text ?? generated ?? '').trim()
      usedModel = generated?.model || 'gemini-2.5-flash'
      usedTokens = Number(generated?.tokens ?? 0)
    } else if (isGeminiConfigured()) {
      const generated = await generateNoaChatReply({
        message: rawContent,
        history,
        context: { userName: req.user.name, deckId }
      })
      replyText = generated.reply
      usedModel = generated.model
      usedTokens = generated.tokens
    } else if (isDeterministicFallbackAllowed()) {
      const firstName = String(req.user.name || 'estudante').split(' ')[0]
      replyText = `Olá, ${firstName}! Sobre "${rawContent.slice(
        0,
        60
      )}": recomendo revisar os conceitos-chave em blocos curtos e focar nos cards que você mais errou hoje.`
      usedModel = 'deterministic-test-fallback'
      usedTokens = 42
    } else {
      return fail(
        res,
        503,
        'ai_unavailable',
        'Provedor de IA não configurado para o chat da Nôa.'
      )
    }

    b.chatUsed = used + 1
    b.chatLimit = limit

    const userMessage = {
      id: id('msg'),
      userId: req.user.id,
      role: 'user',
      content: rawContent,
      metadata: deckId ? { deckId } : {},
      createdAt: nowIso()
    }
    const assistantMessage = {
      id: id('msg'),
      userId: req.user.id,
      role: 'assistant',
      content: replyText,
      metadata: { ...(deckId ? { deckId } : {}), model: usedModel, tokens: usedTokens },
      createdAt: nowIso()
    }
    state.noa.chatMessages.push(userMessage, assistantMessage)

    res.status(201).json({
      userMessage,
      assistantMessage,
      message: assistantMessage,
      budget: { used: b.chatUsed, limit }
    })
  })

  r.post('/noa/suggestions/:id/respond', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const result = await req.data.noa.respondSuggestion(
        req.db,
        req.user,
        req.params.id,
        req.body || {},
        req.data.audit
      )
      if (!result) return fail(res, 404, 'not_found', 'Sugestão não encontrada.')
      return res.json(result)
    }
    const state = req.store.state
    const suggestion = state.noa.suggestions.find(
      (s) => s.id === req.params.id && s.userId === req.user.id
    )
    if (!suggestion) return fail(res, 404, 'not_found', 'Sugestão não encontrada.')
    const { accepted, feedback } = req.body || {}
    suggestion.status = accepted ? 'aceita' : 'dispensada'
    suggestion.respondedAt = nowIso()
    suggestion.feedback = feedback || null
    let effect = null
    if (accepted) {
      if (suggestion.actionKey === 'mark_difficult' && suggestion.deckId) {
        const deck = state.decks.find((d) => d.id === suggestion.deckId)
        if (deck) {
          deck.difficult = true
          effect = {
            type: 'deck_marked_difficult',
            deckId: deck.id,
            deckName: deck.name,
            undo: {
              method: 'PATCH',
              path: `/v1/decks/${deck.id}`,
              body: { difficult: false }
            }
          }
        }
      } else if (suggestion.actionKey === 'adjust_goal' && suggestion.goal) {
        const study = state.study[req.user.id]
        const previous = study.goal
        study.goal = suggestion.goal
        effect = { type: 'goal_adjusted', from: previous, to: suggestion.goal }
      } else if (suggestion.actionKey === 'suggest_reinforcement') {
        effect = { type: 'reinforcement_proposed', deckId: suggestion.deckId }
      }
    }
    state.noa.decisions.unshift({
      id: `dec_${Date.now().toString(36)}`,
      userId: req.user.id,
      actionKey: suggestion.actionKey,
      at: nowIso(),
      text: `${accepted ? 'Você aceitou' : 'Você dispensou'}: ${suggestion.title}`,
      reversible: true,
      reverted: false,
      contested: null,
      accepted
    })
    appendAudit(state, {
      actor: 'noa',
      actorRole: 'agent',
      action: `suggestion_${accepted ? 'accepted' : 'dismissed'}`,
      target: suggestion.id,
      details: { actionKey: suggestion.actionKey }
    })
    res.json({ suggestion, effect })
  })

  r.post('/noa/decisions/:id/revert', requireStudent, async (req, res) => {
    if (req.useSupabase && req.db) {
      const result = await req.data.noa.revertDecision(
        req.db,
        req.user,
        req.params.id,
        req.data.audit
      )
      if (result.notFound) return fail(res, 404, 'not_found', 'Decisão não encontrada.')
      if (result.notReversible) {
        return fail(
          res,
          409,
          'not_reversible',
          'Esta ação não pode ser desfeita automaticamente.'
        )
      }
      return res.json({ decision: result.decision })
    }
    const state = req.store.state
    const decision = state.noa.decisions.find(
      (d) => d.id === req.params.id && d.userId === req.user.id
    )
    if (!decision) return fail(res, 404, 'not_found', 'Decisão não encontrada.')
    if (!decision.reversible) {
      return fail(
        res,
        409,
        'not_reversible',
        'Esta ação não pode ser desfeita automaticamente.'
      )
    }
    decision.reverted = true
    decision.revertedAt = nowIso()
    if (decision.actionKey === 'reorder_queue') {
      state.study[req.user.id].planOrder = ['d2', 'd3', 'd5', 'd1']
    }
    if (decision.actionKey === 'reminder_time') {
      state.notifications[req.user.id].reminderTime = '21:00'
    }
    appendAudit(state, {
      actor: req.user.id,
      actorRole: 'student',
      action: 'noa_decision_reverted',
      target: decision.id,
      details: { actionKey: decision.actionKey }
    })
    res.json({ decision })
  })

  return r
}
