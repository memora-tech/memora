import { Router } from 'express'
import { createSession, requireRole } from '../lib/auth.js'
import { fail } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const requirePartner = requireRole('partner')

function partnerOf(req) {
  const state = req.store.state
  return state.partner.partners.find((p) => p.id === req.user.partnerId)
}

export function partnerRoutes() {
  const r = Router()

  r.post('/auth/login', (req, res) => {
    const state = req.store.state
    const { cnpj, password } = req.body || {}
    if (!cnpj || !password) return fail(res, 422, 'invalid_credentials', 'Informe CNPJ e senha.')
    const user = state.users.find((u) => u.role === 'partner')
    const partner = state.partner.partners.find((p) => p.id === user.partnerId)
    const session = createSession(state, { userId: user.id, role: 'partner', device: 'Painel do Parceiro · Navegador' })
    res.json({ token: session.token, user: { id: user.id, name: user.name, email: user.email, partnerId: partner.id, partnerName: partner.name } })
  })

  r.get('/overview', requirePartner, (req, res) => {
    const state = req.store.state
    const partner = partnerOf(req)
    const campaigns = state.coupons.filter((c) => c.partnerId === partner.id).map((c) => ({ ...c, redemptions: state.partner.redemptions.filter((x) => x.campaignId === c.id).length, used: state.partner.redemptions.filter((x) => x.campaignId === c.id && x.status === 'utilizado').length }))
    const conversion = state.partner.conversion[partner.id] || null
    res.json({
      partner,
      campaigns,
      redemptions: state.partner.redemptions.filter((x) => x.partnerId === partner.id),
      conversion: conversion ? { ...conversion, cells: conversion.cells.map((c) => (c.n >= conversion.minCell ? c : { ...c, n: null, shown: false, suppressed: `Menos de ${conversion.minCell} pessoas` })) } : null,
      positioningTable: state.partner.positioningTable,
      alerts: state.admin.commercialAlerts.filter((a) => a.partnerId === partner.id),
      billing: { model: 'CPA (paga só no resgate) + comissão de intermediação', cpaBRL: partner.contract.cpaBRL, commissionPct: partner.contract.commissionPct, positioningMonthlyBRL: partner.contract.positioningMonthlyBRL },
      api: { baseUrl: '/v1/partner/redemptions/validate', key: 'pk_live_••••••••••7f2a', docs: 'Dê baixa por API ou por este painel. Cada código baixa uma única vez.' }
    })
  })

  r.post('/campaigns', requirePartner, (req, res) => {
    const state = req.store.state
    const partner = partnerOf(req)
    const { title, description, costNeurons, stock, validityDays = 30, terms = '' } = req.body || {}
    if (!title?.trim() || !Number.isInteger(costNeurons) || costNeurons < 1 || !Number.isInteger(stock) || stock < 1) return fail(res, 422, 'validation', 'Título, custo em Neurônios e estoque são obrigatórios.')
    const coupon = { id: id('cp'), partnerId: partner.id, partnerName: partner.name, title: title.trim(), description: description || '', costNeurons, stock, validityDays, positioning: partner.contract.positioningTier === 'Destaque na loja' ? 'destaque' : partner.contract.positioningTier === 'Primeira posição' ? 'primeira_posicao' : null, category: partner.category, terms }
    state.coupons.push(coupon)
    appendAudit(state, { actor: req.user.id, actorRole: 'partner', action: 'campaign_created', target: coupon.id, details: { stock, costNeurons } })
    res.status(201).json({ campaign: coupon })
  })

  r.patch('/campaigns/:id', requirePartner, (req, res) => {
    const state = req.store.state
    const partner = partnerOf(req)
    const coupon = state.coupons.find((c) => c.id === req.params.id && c.partnerId === partner.id)
    if (!coupon) return fail(res, 404, 'not_found', 'Campanha não encontrada.')
    if (Number.isInteger(req.body?.stock) && req.body.stock >= 0) coupon.stock = req.body.stock
    if (typeof req.body?.paused === 'boolean') coupon.paused = req.body.paused
    res.json({ campaign: coupon })
  })

  r.post('/redemptions/validate', requirePartner, (req, res) => {
    const state = req.store.state
    const partner = partnerOf(req)
    const code = String(req.body?.code || '').trim().toUpperCase()
    if (!code) return fail(res, 422, 'validation', 'Digite ou escaneie o código.')
    const redemption = state.partner.redemptions.find((x) => x.code === code && x.partnerId === partner.id)
    const mine = state.myCoupons.find((m) => m.code === code)
    if (!redemption && !mine) return fail(res, 404, 'not_found', 'Código não encontrado para este parceiro.')
    const record = redemption || { code, status: mine.status === 'utilizado' ? 'utilizado' : mine.status === 'expirado_reembolsado' ? 'expirado' : 'emitido', validUntil: mine.validUntil }
    if (record.status === 'utilizado') return fail(res, 409, 'already_used', 'Este código já foi utilizado.', { usedAt: record.usedAt || mine?.usedAt })
    if (record.status === 'expirado' || new Date(record.validUntil).getTime() < Date.now()) return fail(res, 410, 'expired', 'Este código expirou. Os Neurônios voltaram para o aluno.')
    const at = nowIso()
    if (redemption) { redemption.status = 'utilizado'; redemption.usedAt = at }
    if (mine) { mine.status = 'utilizado'; mine.usedAt = at }
    appendAudit(state, { actor: req.user.id, actorRole: 'partner', action: 'coupon_used', target: code, details: {} })
    res.json({ ok: true, code, usedAt: at, message: 'Baixa registrada. Este código não pode ser usado de novo.' })
  })

  r.post('/contract/accept', requirePartner, (req, res) => {
    const partner = partnerOf(req)
    partner.contract.acceptedDigitally = true
    partner.contract.acceptedAt = nowIso()
    appendAudit(req.store.state, { actor: req.user.id, actorRole: 'partner', action: 'contract_accepted', target: partner.id, details: {} })
    res.json({ contract: partner.contract })
  })

  return r
}
