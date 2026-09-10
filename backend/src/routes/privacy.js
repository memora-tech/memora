import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail } from '../lib/helpers.js'
import { id, nowIso, daysFromNow } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export function privacyRoutes() {
  const r = Router()

  r.post('/privacy/export', requireStudent, (req, res) => {
    const state = req.store.state
    const request = { id: id('exp'), userId: req.user.id, requestedAt: nowIso(), dueBy: daysFromNow(15), linkValidDays: 7, format: 'JSON + CSV, mídia em ZIP', contents: ['decks', 'cards', 'histórico de estudo', 'Neurônios', 'comentários', 'pagamentos'], status: 'em_preparo' }
    state.privacy.exports.unshift(request)
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'data_export_requested', target: req.user.id, details: { requestId: request.id } })
    res.status(201).json({ request })
  })

  r.get('/privacy/export', requireStudent, (req, res) => {
    res.json({ requests: req.store.state.privacy.exports.filter((e) => e.userId === req.user.id) })
  })

  r.post('/privacy/delete', requireStudent, (req, res) => {
    const state = req.store.state
    const deletion = { id: id('del'), userId: req.user.id, requestedAt: nowIso(), purgeAt: daysFromNow(30), reactivable: true, status: 'desativada', effects: ['Comentários e votos ficam sem autor', 'Decks publicados continuam disponíveis sem autor vinculado', 'Assinatura cancelada sem nova cobrança', 'Neurônios e cupons não usados expiram', 'Você sai das pastas compartilhadas', 'Dados pessoais excluídos após 30 dias; dados fiscais ficam 5 anos em base segregada'] }
    state.privacy.deletions.unshift(deletion)
    req.user.deactivatedAt = deletion.requestedAt
    const sub = state.subscriptions[req.user.id]
    if (sub && req.user.plan === 'premium') sub.cancelledAt = nowIso()
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'account_deletion_requested', target: req.user.id, details: { purgeAt: deletion.purgeAt } })
    res.status(201).json({ deletion })
  })

  r.post('/privacy/reactivate', requireStudent, (req, res) => {
    const state = req.store.state
    const pending = state.privacy.deletions.find((d) => d.userId === req.user.id && d.status === 'desativada')
    if (!pending) return fail(res, 409, 'not_deactivated', 'A conta não está desativada.')
    pending.status = 'reativada'
    pending.reactivatedAt = nowIso()
    req.user.deactivatedAt = null
    res.json({ ok: true })
  })

  r.get('/privacy/decisions', requireStudent, (req, res) => {
    const state = req.store.state
    const decisions = state.noa.decisions.filter((d) => d.userId === req.user.id).map((d) => ({ ...d, action: state.noa.catalog.find((c) => c.key === d.actionKey) || null })).sort((a, b) => b.at.localeCompare(a.at))
    res.json({ decisions, rights: { law: 'LGPD art. 20', responseDays: 15, criteriaExplained: true }, catalogVersion: state.noa.catalogVersion })
  })

  r.post('/privacy/decisions/:id/contest', requireStudent, (req, res) => {
    const state = req.store.state
    const decision = state.noa.decisions.find((d) => d.id === req.params.id && d.userId === req.user.id)
    if (!decision) return fail(res, 404, 'not_found', 'Decisão não encontrada.')
    const { text } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Explique por que discorda da decisão.')
    decision.contested = { at: nowIso(), text: text.trim(), dueBy: daysFromNow(15), status: 'em_analise', reviewer: 'humano (compliance)' }
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'automated_decision_contested', target: decision.id, details: {} })
    res.json({ decision })
  })

  r.get('/privacy/policy', requireStudent, (req, res) => {
    const state = req.store.state
    res.json({ policy: state.admin.policy, dpo: { email: state.admin.dpo.email, name: state.admin.dpo.name }, summary: ['Conteúdo próprio ou com permissão de uso', 'Sem dados pessoais de terceiros', 'Sem material impróprio ou discriminatório', 'Rejeições vêm com motivo e trecho apontado; contestação em 30 dias'] })
  })

  return r
}
