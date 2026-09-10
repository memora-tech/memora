import { Router } from 'express'
import { applyProfile, PROFILES } from '../seed/index.js'
import { balanceOf, appendEntry } from '../lib/ledger.js'
import { fail, ensureDay } from '../lib/helpers.js'
import { nowIso } from '../lib/ids.js'

const TONES = {
  leve: {
    push: { title: 'Seus cards estão esperando', body: '18 cards para hoje, uns 6 minutos. Quando quiser.' },
    whatsapp: { title: 'Memora', body: 'Oi! Sua sessão de hoje tem 18 cards. Bons estudos 😊' }
  },
  padrao: {
    push: { title: 'Sua streak de 12 dias está em jogo', body: '18 cards separam você do dia 13. Seis minutos e pronto.' },
    whatsapp: { title: 'Memora', body: 'ENEM em 23 dias e 18 cards esperando. Você vai deixar a streak de 12 dias cair hoje?' }
  },
  intenso: {
    push: { title: '12 dias de streak. Vai jogar fora?', body: 'Quem parou ontem já está atrás de você. 18 cards. Agora.' },
    whatsapp: { title: 'Memora', body: 'Faltam 23 dias para o ENEM e você ainda não abriu o app hoje. Seus concorrentes abriram. 18 cards. Vai?' }
  }
}

export function protoRoutes() {
  const r = Router()

  r.get('/state', (req, res) => {
    const state = req.store.state
    ensureDay(state, 'u1')
    res.json({ profile: state.profile, profiles: Object.keys(PROFILES), balance: balanceOf(state, 'u1'), quota: state.generation.quota.u1, couponAvailable: balanceOf(state, 'u1') >= Math.min(...state.coupons.filter((c) => c.stock > 0).map((c) => c.costNeurons)), intensity: state.notifications.u1.intensity, seededAt: state.seededAt })
  })

  r.post('/reset', (req, res) => {
    const profile = req.body?.profile || 'adult-free'
    const state = req.store.reset(profile)
    res.json({ ok: true, profile: state.profile, seededAt: state.seededAt })
  })

  r.post('/profile', (req, res) => {
    const { profile } = req.body || {}
    if (!PROFILES[profile]) return fail(res, 422, 'validation', 'Perfil inválido.', { profiles: Object.keys(PROFILES) })
    const state = req.store.state
    applyProfile(state, profile)
    res.json({ ok: true, profile })
  })

  r.post('/coupon-available', (req, res) => {
    const state = req.store.state
    const available = Boolean(req.body?.available)
    const balance = balanceOf(state, 'u1')
    const cheapest = Math.min(...state.coupons.filter((c) => c.stock > 0).map((c) => c.costNeurons))
    if (!available && balance >= cheapest) {
      appendEntry(state, { userId: 'u1', amount: -(balance - Math.max(0, cheapest - 8)), type: 'proto_adjustment', meta: { reason: 'Ajuste do protótipo: cenário sem cupom resgatável' } })
    } else if (available && balance < cheapest) {
      appendEntry(state, { userId: 'u1', amount: cheapest - balance + 118, type: 'proto_adjustment', meta: { reason: 'Ajuste do protótipo: cenário com cupom resgatável' } })
    }
    res.json({ ok: true, balance: balanceOf(state, 'u1') })
  })

  r.post('/notification', (req, res) => {
    const state = req.store.state
    const channel = req.body?.channel === 'whatsapp' ? 'whatsapp' : 'push'
    const intensity = state.notifications.u1.intensity
    const tone = TONES[intensity] || TONES.padrao
    const consents = state.consents.u1
    if (channel === 'whatsapp' && !consents.whatsapp.lembretes) {
      return res.json({ delivered: false, reason: 'Opt-in de lembretes no WhatsApp desligado. Nada foi enviado.', channel })
    }
    const limits = state.notifications.u1.limits
    const sent = state.notifications.u1.sentToday
    const force = Boolean(req.body?.force)
    if ((channel === 'whatsapp' && sent.whatsapp >= limits.whatsappPerDay) || (channel === 'push' && sent.push >= limits.pushPerDay)) {
      return res.json({ delivered: false, reason: `Limite diário de ${channel === 'whatsapp' ? limits.whatsappPerDay + ' mensagens de WhatsApp' : limits.pushPerDay + ' push'} atingido.`, channel })
    }
    const user = state.users.find((u) => u.id === 'u1')
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: user.timezone || 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()))
    const qw = state.notifications.u1.quietWindow
    const [qs] = qw.start.split(':').map(Number)
    const [qe] = qw.end.split(':').map(Number)
    const inQuiet = qs > qe ? hour >= qs || hour < qe : hour >= qs && hour < qe
    if (inQuiet && !force) {
      return res.json({ delivered: false, reason: `Janela de silêncio das ${qw.start} às ${qw.end}: a notificação fica para o fim da janela.`, channel })
    }
    const lastSent = (state.notifications.u1.lastSent = state.notifications.u1.lastSent || {})
    const topicKey = `${channel}:lembretes`
    if (lastSent[topicKey] && Date.now() - new Date(lastSent[topicKey]).getTime() < 2 * 3600000 && !force) {
      return res.json({ delivered: false, reason: 'Deduplicada: o mesmo tema já foi enviado há menos de 2 h neste canal.', channel })
    }
    lastSent[topicKey] = nowIso()
    sent[channel] += 1
    res.json({ delivered: true, notification: { id: `ntf_${Date.now().toString(36)}`, channel, intensity, ...tone[channel], deepLink: '/app', at: nowIso(), category: 'lembretes' } })
  })

  return r
}
