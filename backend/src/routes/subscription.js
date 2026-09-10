import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, PLAN_LIMITS } from '../lib/helpers.js'
import { id, nowIso, daysFromNow } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const PRICES = { mensal: 29.9, anual: 239.9 }
const METHODS = { cartao: 'Cartão de crédito', pix_automatico: 'Pix Automático', pix: 'Pix avulso', boleto: 'Boleto' }

export function subscriptionView(state, user) {
  const sub = state.subscriptions[user.id]
  return {
    ...sub,
    plan: user.plan,
    limits: PLAN_LIMITS[user.plan],
    premiumBenefits: ['Orçamento de geração maior (10 mil / 4 mil tokens)', '10 decks por dia', 'Prioridade nas filas de geração e moderação (SLA 24 h)', '20 decks fixados offline'],
    fairUseExplained: 'Teto mensal de custo de IA de cerca de R$ 20 por pessoa. Acima dele, as gerações continuam no Sonnet 5 em esforço médio com o orçamento do gratuito, com aviso. Nunca bloqueia.',
    noAds: true,
    prices: PRICES,
    methods: METHODS,
    refundPolicy: 'Arrependimento em 7 dias (CDC art. 49): reembolso integral em dinheiro, em autoatendimento.',
    cancelPolicy: 'Cancelamento em até 3 toques, no mesmo canal; acesso até o fim do período pago; aviso antes da renovação.'
  }
}

export function subscriptionRoutes() {
  const r = Router()

  r.get('/subscription', requireStudent, (req, res) => {
    res.json(subscriptionView(req.store.state, req.user))
  })

  r.post('/subscription/subscribe', requireStudent, (req, res) => {
    const state = req.store.state
    const { cycle = 'mensal', method = 'cartao' } = req.body || {}
    if (!PRICES[cycle]) return fail(res, 422, 'validation', 'Ciclo inválido.')
    if (!METHODS[method]) return fail(res, 422, 'validation', 'Forma de pagamento inválida.')
    if (method === 'pix_automatico' && cycle !== 'mensal') return fail(res, 422, 'validation', 'Pix Automático só no plano mensal.')
    if (method === 'boleto' && cycle !== 'anual') return fail(res, 422, 'validation', 'Boleto só no plano anual.')
    const pending = method === 'boleto' || method === 'pix'
    const payment = { id: id('pay'), at: nowIso(), amountBRL: PRICES[cycle], method: METHODS[method], status: pending ? 'aguardando_pagamento' : 'pago', nfse: pending ? null : { number: `NFS-e 2026/${String(400 + state.auditLog.length).padStart(5, '0')}`, availableAt: daysFromNow(2), url: '#nfse' } }
    const sub = {
      plan: pending ? 'free' : 'premium',
      pendingActivation: pending,
      cycle,
      priceBRL: PRICES[cycle],
      method: METHODS[method],
      startedAt: pending ? null : nowIso(),
      renewsAt: pending ? null : daysFromNow(cycle === 'mensal' ? 30 : 365),
      refundEligibleUntil: pending ? null : daysFromNow(7),
      fairUse: { usedBRL: 0, capBRL: 20, generationsMonth: 0, degraded: false },
      payments: [payment],
      dunning: null,
      cancelledAt: null
    }
    state.subscriptions[req.user.id] = sub
    if (!pending) req.user.plan = 'premium'
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'subscription_started', target: req.user.id, details: { cycle, method, pending } })
    res.status(201).json({ subscription: subscriptionView(state, req.user), payment, activation: pending ? 'Liberamos o Premium assim que o pagamento for confirmado.' : 'Premium ativo agora.' })
  })

  r.post('/subscription/webhook', (req, res) => {
    const state = req.store.state
    const { eventId, type, userId = 'u1' } = req.body || {}
    if (!eventId || !type) return fail(res, 422, 'validation', 'eventId e type são obrigatórios.')
    state.webhookEvents = state.webhookEvents || {}
    if (state.webhookEvents[eventId]) return res.json({ ok: true, duplicate: true })
    state.webhookEvents[eventId] = { type, at: nowIso() }
    const user = state.users.find((u) => u.id === userId)
    const sub = state.subscriptions[userId]
    if (!user || !sub) return fail(res, 404, 'not_found', 'Assinatura não encontrada.')
    if (type === 'payment_confirmed') {
      sub.plan = 'premium'
      sub.pendingActivation = false
      sub.startedAt = nowIso()
      sub.renewsAt = daysFromNow(sub.cycle === 'mensal' ? 30 : 365)
      sub.refundEligibleUntil = daysFromNow(7)
      sub.payments.forEach((p) => { if (p.status === 'aguardando_pagamento') { p.status = 'pago'; p.nfse = { number: `NFS-e 2026/${String(400 + state.auditLog.length).padStart(5, '0')}`, availableAt: daysFromNow(2), url: '#nfse' } } })
      user.plan = 'premium'
    } else if (type === 'payment_failed') {
      sub.dunning = sub.dunning || { attempts: 0, startedAt: nowIso(), graceUntil: null }
      sub.dunning.attempts += 1
      if (sub.dunning.attempts >= 3) {
        sub.dunning.graceUntil = daysFromNow(3)
      }
    } else if (type === 'grace_expired') {
      sub.plan = 'free'
      sub.downgradedAt = nowIso()
      sub.decksPreserved = true
      user.plan = 'free'
    }
    appendAudit(state, { actor: 'gateway', actorRole: 'integration', action: `webhook_${type}`, target: userId, details: { eventId } })
    res.json({ ok: true, subscription: subscriptionView(state, user) })
  })

  r.post('/subscription/cancel', requireStudent, (req, res) => {
    const state = req.store.state
    const sub = state.subscriptions[req.user.id]
    if (req.user.plan !== 'premium') return fail(res, 409, 'not_premium', 'Você não tem uma assinatura ativa.')
    sub.cancelledAt = nowIso()
    sub.accessUntil = sub.renewsAt
    sub.renewalNotice = false
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'subscription_cancelled', target: req.user.id, details: { accessUntil: sub.accessUntil } })
    res.json({ subscription: subscriptionView(state, req.user), message: `Assinatura cancelada. Você mantém o Premium até ${new Date(sub.accessUntil).toLocaleDateString('pt-BR')} e não haverá nova cobrança.` })
  })

  r.post('/subscription/refund', requireStudent, (req, res) => {
    const state = req.store.state
    const sub = state.subscriptions[req.user.id]
    if (req.user.plan !== 'premium') return fail(res, 409, 'not_premium', 'Você não tem uma assinatura ativa.')
    if (!sub.refundEligibleUntil || new Date(sub.refundEligibleUntil).getTime() < Date.now()) return fail(res, 409, 'refund_window_closed', 'O prazo de 7 dias para arrependimento já passou. Você ainda pode cancelar.')
    const last = sub.payments[sub.payments.length - 1]
    if (last) last.status = 'reembolsado'
    state.subscriptions[req.user.id] = { plan: 'free', offer: { monthlyBRL: 29.9, yearlyBRL: 239.9, yearlyPerMonthBRL: 19.99 }, payments: sub.payments, refundedAt: nowIso(), cancelledAt: nowIso() }
    req.user.plan = 'free'
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'subscription_refunded', target: req.user.id, details: { amountBRL: last?.amountBRL } })
    res.json({ subscription: subscriptionView(state, req.user), refund: { amountBRL: last?.amountBRL, method: 'Mesmo meio de pagamento', within: '7 dias' } })
  })

  r.get('/subscription/invoices', requireStudent, (req, res) => {
    const sub = req.store.state.subscriptions[req.user.id]
    res.json({ payments: sub.payments || [], nfseSla: 'Disponível no perfil em até 48 h após a cobrança.' })
  })

  return r
}
