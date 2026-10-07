import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, ensureDay, ownDecksOf, cardsOfDeck } from '../lib/helpers.js'
import { todaySession } from './study.js'
import { nowIso } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export function noaRoutes() {
  const r = Router()

  r.get('/noa/catalog', requireStudent, (req, res) => {
    const state = req.store.state
    ensureDay(state, req.user.id)
    res.json({ version: state.noa.catalogVersion, actions: state.noa.catalog, budget: state.noa.budget[req.user.id], signals: ['frequência e horário de acesso', 'acertos e erros', 'decks usados ou abandonados', 'streak e Neurônios'], neverAlone: ['excluir ou alterar dados sem confirmação', 'notificar fora da janela de silêncio', 'penalizar reputação, banir ou suspender cupons sem revisão humana', 'expandir sinais analisados sem aviso'] })
  })

  r.get('/noa/overview', requireStudent, (req, res) => {
    const state = req.store.state
    ensureDay(state, req.user.id)
    const suggestions = state.noa.suggestions.filter((s) => s.userId === req.user.id && s.status === 'pendente')
    const decisions = state.noa.decisions.filter((d) => d.userId === req.user.id).slice(0, 10)
    const connections = state.mcp.connections.filter((c) => c.userId === req.user.id && !c.revokedAt)
    const aiSaved = state.mcp.activity.filter((a) => a.userId === req.user.id && a.ok && a.write).length
    const today = todaySession(state, req.user.id)
    const own = ownDecksOf(state, req.user.id)
    const weakest = own
      .map((d) => {
        const cards = cardsOfDeck(state, d.id)
        return { id: d.id, name: d.name, lapses: cards.reduce((n, c) => n + (c.sched?.lapses || 0), 0), weakCards: cards.filter((c) => (c.sched?.lapses || 0) > 0).length }
      })
      .filter((d) => d.lapses > 0)
      .sort((a, b) => b.lapses - a.lapses)[0] || null
    const recent = state.reviews.filter((r) => r.userId === req.user.id).slice(-30)
    const accuracy = recent.length ? Math.round((recent.filter((r) => r.rating === 'good' || r.rating === 'easy').length / recent.length) * 100) : null
    const insights = {
      today: { cardsDue: today.cardsDue, minutes: today.estimatedMinutes, decks: today.plan.length, status: today.status },
      weakest,
      objective: today.nearestObjective ? { id: today.nearestObjective.id, name: today.nearestObjective.name, daysLeft: today.nearestObjective.daysLeft } : null,
      accuracy: accuracy === null ? null : { pct: accuracy, sample: recent.length },
      goal: { done: today.doneToday, goal: today.goal, suggested: today.goalSuggested || null },
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
      signals: ['frequência e horário de acesso', 'acertos e erros', 'decks usados ou abandonados', 'streak e Neurônios'],
      neverAlone: ['excluir ou alterar dados sem confirmação', 'notificar fora da janela de silêncio', 'penalizar reputação, banir ou suspender cupons sem revisão humana', 'expandir sinais analisados sem aviso']
    })
  })

  r.post('/noa/suggestions/:id/respond', requireStudent, (req, res) => {
    const state = req.store.state
    const suggestion = state.noa.suggestions.find((s) => s.id === req.params.id && s.userId === req.user.id)
    if (!suggestion) return fail(res, 404, 'not_found', 'Sugestão não encontrada.')
    const { accepted, feedback } = req.body || {}
    suggestion.status = accepted ? 'aceita' : 'dispensada'
    suggestion.respondedAt = nowIso()
    suggestion.feedback = feedback || null
    let effect = null
    if (accepted) {
      if (suggestion.actionKey === 'mark_difficult' && suggestion.deckId) {
        const deck = state.decks.find((d) => d.id === suggestion.deckId)
        if (deck) { deck.difficult = true; effect = { type: 'deck_marked_difficult', deckId: deck.id, deckName: deck.name, undo: { method: 'PATCH', path: `/v1/decks/${deck.id}`, body: { difficult: false } } } }
      } else if (suggestion.actionKey === 'adjust_goal' && suggestion.goal) {
        const study = state.study[req.user.id]
        const previous = study.goal
        study.goal = suggestion.goal
        effect = { type: 'goal_adjusted', from: previous, to: suggestion.goal }
      } else if (suggestion.actionKey === 'suggest_reinforcement') {
        effect = { type: 'reinforcement_proposed', deckId: suggestion.deckId }
      }
    }
    state.noa.decisions.unshift({ id: `dec_${Date.now().toString(36)}`, userId: req.user.id, actionKey: suggestion.actionKey, at: nowIso(), text: `${accepted ? 'Você aceitou' : 'Você dispensou'}: ${suggestion.title}`, reversible: true, reverted: false, contested: null, accepted })
    appendAudit(state, { actor: 'noa', actorRole: 'agent', action: `suggestion_${accepted ? 'accepted' : 'dismissed'}`, target: suggestion.id, details: { actionKey: suggestion.actionKey } })
    res.json({ suggestion, effect })
  })

  r.post('/noa/decisions/:id/revert', requireStudent, (req, res) => {
    const state = req.store.state
    const decision = state.noa.decisions.find((d) => d.id === req.params.id && d.userId === req.user.id)
    if (!decision) return fail(res, 404, 'not_found', 'Decisão não encontrada.')
    if (!decision.reversible) return fail(res, 409, 'not_reversible', 'Esta ação não pode ser desfeita automaticamente.')
    decision.reverted = true
    decision.revertedAt = nowIso()
    if (decision.actionKey === 'reorder_queue') state.study[req.user.id].planOrder = ['d2', 'd3', 'd5', 'd1']
    if (decision.actionKey === 'reminder_time') state.notifications[req.user.id].reminderTime = '21:00'
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'noa_decision_reverted', target: decision.id, details: { actionKey: decision.actionKey } })
    res.json({ decision })
  })

  return r
}
