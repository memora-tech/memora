import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail, requireVerified } from '../lib/helpers.js'
import { balanceOf, ledgerOf, debit } from '../lib/ledger.js'
import { id, nowIso, daysFromNow, couponCode } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

export const REDEEM_MIN_STUDY_DAYS = 10

const positioningRank = { primeira_posicao: 0, destaque: 1 }

export function walletSummary(state, user) {
  const balance = balanceOf(state, user.id)
  const study = state.study[user.id]
  const coupons = state.coupons.slice().sort((a, b) => (positioningRank[a.positioning] ?? 2) - (positioningRank[b.positioning] ?? 2) || a.costNeurons - b.costNeurons)
  const affordable = coupons.filter((c) => c.stock > 0 && c.costNeurons <= balance)
  const nextUnaffordable = coupons.filter((c) => c.stock > 0 && c.costNeurons > balance).sort((a, b) => a.costNeurons - b.costNeurons)[0] || null
  const canRedeem = { ok: study.studyDays >= REDEEM_MIN_STUDY_DAYS && Boolean(user.verified?.email && user.verified?.phone), studyDays: study.studyDays, required: REDEEM_MIN_STUDY_DAYS, verified: Boolean(user.verified?.email && user.verified?.phone) }
  const accountDays = Math.round((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
  const reviewsCount = state.reviews.filter((r) => r.userId === user.id).length + study.studyDays
  return {
    balance,
    ledger: ledgerOf(state, user.id),
    redeemable: affordable.length > 0 && canRedeem.ok,
    redeemableCount: affordable.length,
    nextCoupon: nextUnaffordable ? { coupon: nextUnaffordable, missing: nextUnaffordable.costNeurons - balance } : null,
    cheapest: coupons.filter((c) => c.stock > 0)[0] || null,
    canRedeem,
    abuseFlag: accountDays >= 7 && reviewsCount === 0,
    myCoupons: state.myCoupons.filter((m) => m.userId === user.id).sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt)),
    referral: canRedeem.verified ? { code: `MEM-${user.name.toUpperCase().replace(/\s+/g, '').slice(0, 6)}`, bonus: 20, rule: 'O indicado precisa concluir a verificação e estudar em ao menos 3 dos primeiros 7 dias. Indicações do mesmo aparelho ou IP não pontuam.' } : null,
    rules: { dailyAccess: 1, goalBonus: 5, neverPurchasable: true, expiryRefund: true }
  }
}

export function walletRoutes() {
  const r = Router()

  r.get('/wallet', requireStudent, (req, res) => {
    res.json(walletSummary(req.store.state, req.user))
  })

  r.get('/coupons', requireStudent, (req, res) => {
    const state = req.store.state
    const balance = balanceOf(state, req.user.id)
    const coupons = state.coupons
      .slice()
      .sort((a, b) => (positioningRank[a.positioning] ?? 2) - (positioningRank[b.positioning] ?? 2) || a.costNeurons - b.costNeurons)
      .map((c) => ({ ...c, affordable: c.costNeurons <= balance, soldOut: c.stock <= 0, lastUnits: c.stock > 0 && c.stock <= 3 }))
    res.json({ coupons, balance })
  })

  r.get('/coupons/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const coupon = state.coupons.find((c) => c.id === req.params.id)
    if (!coupon) return fail(res, 404, 'not_found', 'Cupom não encontrado.')
    const balance = balanceOf(state, req.user.id)
    const partner = state.partner.partners.find((p) => p.id === coupon.partnerId)
    res.json({ coupon: { ...coupon, affordable: coupon.costNeurons <= balance, soldOut: coupon.stock <= 0, lastUnits: coupon.stock > 0 && coupon.stock <= 3 }, partner: partner ? { name: partner.name, category: partner.category, verified: partner.verified } : null, balance, canRedeem: walletSummary(state, req.user).canRedeem })
  })

  r.post('/coupons/:id/redeem', requireStudent, (req, res) => {
    const state = req.store.state
    const coupon = state.coupons.find((c) => c.id === req.params.id)
    if (!coupon) return fail(res, 404, 'not_found', 'Cupom não encontrado.')
    const key = req.body?.idempotencyKey
    if (key) {
      const existing = state.myCoupons.find((m) => m.idempotencyKey === key)
      if (existing) return res.json({ myCoupon: existing, balance: balanceOf(state, req.user.id), duplicate: true })
    }
    const unverified = requireVerified(req.user)
    if (unverified) return fail(res, 403, unverified.code, 'Confirme e-mail e telefone para resgatar.', unverified)
    const summary = walletSummary(state, req.user)
    if (!summary.canRedeem.ok) return fail(res, 422, 'study_days_required', `Resgates exigem ao menos ${REDEEM_MIN_STUDY_DAYS} dias com estudo registrado.`, summary.canRedeem)
    if (coupon.stock <= 0) return fail(res, 409, 'sold_out', 'Este cupom acabou de esgotar.', { stock: 0 })
    if (summary.balance < coupon.costNeurons) return fail(res, 422, 'insufficient_balance', `Faltam ${coupon.costNeurons - summary.balance} Neurônios.`, { missing: coupon.costNeurons - summary.balance })

    coupon.stock -= 1
    const myCoupon = {
      id: id('mc'),
      userId: req.user.id,
      couponId: coupon.id,
      partnerId: coupon.partnerId,
      partnerName: coupon.partnerName,
      title: coupon.title,
      code: couponCode(),
      redeemedAt: nowIso(),
      validUntil: daysFromNow(coupon.validityDays),
      status: 'emitido',
      usedAt: null,
      idempotencyKey: key || null
    }
    debit(state, req.user.id, coupon.costNeurons, 'coupon_redeem', { couponId: coupon.id, partner: coupon.partnerName, myCouponId: myCoupon.id, title: coupon.title })
    state.myCoupons.push(myCoupon)
    state.partner.redemptions.unshift({ id: id('rd'), partnerId: coupon.partnerId, code: myCoupon.code, redeemedAt: myCoupon.redeemedAt, validUntil: myCoupon.validUntil, status: 'emitido', campaignId: coupon.id })
    appendAudit(state, { actor: req.user.id, actorRole: 'student', action: 'coupon_redeemed', target: coupon.id, details: { cost: coupon.costNeurons, stockAfter: coupon.stock } })
    res.status(201).json({ myCoupon, balance: balanceOf(state, req.user.id), stockLeft: coupon.stock })
  })

  r.get('/wallet/coupons', requireStudent, (req, res) => {
    const state = req.store.state
    res.json({ myCoupons: state.myCoupons.filter((m) => m.userId === req.user.id).sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt)) })
  })

  r.get('/wallet/coupons/:id', requireStudent, (req, res) => {
    const state = req.store.state
    const mine = state.myCoupons.find((m) => m.id === req.params.id && m.userId === req.user.id)
    if (!mine) return fail(res, 404, 'not_found', 'Cupom não encontrado.')
    const coupon = state.coupons.find((c) => c.id === mine.couponId)
    res.json({ myCoupon: mine, coupon, qrPayload: `memora://coupon/${mine.code}` })
  })

  return r
}
