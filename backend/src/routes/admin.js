import { Router } from 'express'
import { createSession, requireRole } from '../lib/auth.js'
import { fail, categoryName } from '../lib/helpers.js'
import { id, nowIso, hoursFromNow, daysFromNow } from '../lib/ids.js'
import { appendAudit, verifyChain, recordAccess } from '../lib/audit.js'
import { balanceOf } from '../lib/ledger.js'
import { ensureCommunityAuthor } from '../lib/publishing.js'

const ROLES = ['moderador', 'suporte_n1', 'suporte_n2', 'comercial', 'financeiro', 'compliance', 'engenharia']
const any = requireRole(...ROLES.map((x) => `admin_${x}`))
const only = (...roles) => requireRole(...roles.map((x) => `admin_${x}`), 'admin_engenharia')

const REJECTION_CATEGORIES = ['veracidade', 'material_protegido', 'conteudo_improprio', 'dados_pessoais', 'duplicidade', 'incompleto', 'idioma']

function slaInfo(pub) {
  if (pub.decidedAt) return { pct: 100, dueAt: null, alert: false, hoursLeft: 0 }
  const elapsed = (Date.now() - new Date(pub.submittedAt).getTime()) / 3600000
  const pct = Math.min(100, Math.round((elapsed / pub.slaHours) * 100))
  return { pct, dueAt: new Date(new Date(pub.submittedAt).getTime() + pub.slaHours * 3600000).toISOString(), alert: pct >= 70, hoursLeft: Math.max(0, Math.round(pub.slaHours - elapsed)) }
}

const mask = (value, keep = 3) => (value ? `${String(value).slice(0, keep)}${'•'.repeat(Math.max(3, String(value).length - keep - 4))}${String(value).slice(-4)}` : null)

export function adminRoutes() {
  const r = Router()

  r.post('/auth/login', (req, res) => {
    const state = req.store.state
    const { role = 'moderador' } = req.body || {}
    if (!ROLES.includes(role)) return fail(res, 422, 'validation', 'Papel inválido.', { roles: ROLES })
    const user = state.users.find((u) => u.role === `admin_${role}`)
    const session = createSession(state, { userId: user.id, role: `admin_${role}`, device: 'Back-office · Navegador' })
    res.json({ token: session.token, user: { id: user.id, name: user.name, role, areas: user.areas || null }, roles: ROLES })
  })

  r.get('/me', any, (req, res) => {
    res.json({ user: { id: req.user.id, name: req.user.name, role: req.session.role.replace('admin_', ''), areas: req.user.areas || null }, roles: ROLES, team: req.store.state.admin.teamPlan })
  })

  r.get('/moderation/queue', only('moderador', 'compliance'), (req, res) => {
    const state = req.store.state
    const queue = state.publications
      .map((p) => ({ ...p, snapshot: undefined, sla: slaInfo(p), categoryName: categoryName(state, p.categoryId) }))
      .sort((a, b) => Number(Boolean(a.decidedAt)) - Number(Boolean(b.decidedAt)) || b.sla.pct - a.sla.pct || b.risk.score - a.risk.score)
    res.json({ queue, pipeline: { autoTriage: ['classificador de conteúdo', 'duplicidade', 'idioma', 'completude'], integralReview: ['risco alto', 'primeiros 5 decks do autor'], sampleReview: 'autores com histórico limpo', sla: { premium: 24, free: '48 a 72' }, alertAtPct: 70 }, categories: REJECTION_CATEGORIES })
  })

  r.get('/moderation/reports', only('moderador', 'compliance'), (req, res) => {
    const reports = req.store.state.reports.slice().sort((a, b) => (a.status === 'aberta' ? -1 : 1) - (b.status === 'aberta' ? -1 : 1) || (a.slaHours || 72) - (b.slaHours || 72) || b.createdAt.localeCompare(a.createdAt))
    res.json({ reports })
  })

  r.get('/moderation/appeals', only('moderador', 'compliance'), (req, res) => {
    res.json({ appeals: req.store.state.appeals })
  })

  r.get('/moderation/:id', only('moderador', 'compliance'), (req, res) => {
    const state = req.store.state
    const pub = state.publications.find((p) => p.id === req.params.id)
    if (!pub) return fail(res, 404, 'not_found', 'Publicação não encontrada.')
    const authorHistory = state.publications.filter((p) => p.authorId === pub.authorId && p.id !== pub.id).map((p) => ({ id: p.id, deckName: p.deckName, status: p.status, decidedAt: p.decidedAt }))
    const snapshot = pub.snapshot || state.cards.filter((c) => c.deckId === pub.deckId).map(({ sched: _s, ...c }) => c)
    res.json({ publication: { ...pub, snapshot, sla: slaInfo(pub), categoryName: categoryName(state, pub.categoryId) }, authorHistory, categories: REJECTION_CATEGORIES })
  })

  r.post('/moderation/:id/assign', only('moderador'), (req, res) => {
    const pub = req.store.state.publications.find((p) => p.id === req.params.id)
    if (!pub) return fail(res, 404, 'not_found', 'Publicação não encontrada.')
    pub.assignedTo = req.user.id
    pub.status = pub.status === 'em_triagem' ? 'em_revisao' : pub.status
    res.json({ publication: { ...pub, snapshot: undefined } })
  })

  r.post('/moderation/:id/decide', only('moderador'), (req, res) => {
    const state = req.store.state
    const pub = state.publications.find((p) => p.id === req.params.id)
    if (!pub) return fail(res, 404, 'not_found', 'Publicação não encontrada.')
    if (pub.decidedAt) return fail(res, 409, 'already_decided', 'Esta publicação já foi decidida.')
    const { decision, reasonCategory, excerpt } = req.body || {}
    if (!['aprovado', 'rejeitado'].includes(decision)) return fail(res, 422, 'validation', 'Decisão inválida.')
    if (decision === 'rejeitado' && (!REJECTION_CATEGORIES.includes(reasonCategory) || !excerpt?.trim())) return fail(res, 422, 'validation', 'Rejeição exige motivo categorizado e trecho apontado.', { categories: REJECTION_CATEGORIES })
    pub.status = decision
    pub.decidedAt = nowIso()
    pub.decision = { by: req.user.id, byName: req.user.name, decision, reasonCategory: reasonCategory || null, excerpt: excerpt || null, appealDeadline: decision === 'rejeitado' ? daysFromNow(30) : null }
    if (pub.kind === 'material') {
      const material = state.materials.find((m) => m.id === pub.materialId)
      if (material) {
        material.status = decision
        material.updatedAt = nowIso()
        if (decision === 'aprovado') {
          material.publishedAt = nowIso()
          ensureCommunityAuthor(state, pub)
        } else {
          material.lastRejection = { reasonCategory, excerpt, appealDeadline: pub.decision.appealDeadline }
        }
      }
      appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: `publication_${decision}`, target: pub.id, details: { reasonCategory: reasonCategory || null, materialId: pub.materialId } })
      return res.json({ publication: { ...pub, snapshot: undefined, sla: slaInfo(pub) } })
    }
    const deck = state.decks.find((d) => d.id === pub.deckId)
    if (decision === 'aprovado') {
      pub.publicId = pub.publicId || `p-${pub.deckId}-${pub.version}`
      if (deck) deck.publication = { status: 'aprovado', publicationId: pub.id, publicId: pub.publicId, version: pub.version, pendingVersion: null }
      const author = ensureCommunityAuthor(state, pub)
      author.decksCount += 1
      const existing = state.community.decks.find((d) => d.publicId === pub.publicId)
      const snapshot = pub.snapshot || state.cards.filter((c) => c.deckId === pub.deckId).map(({ sched: _s, ...c }) => c)
      if (existing) {
        existing.version = pub.version
        existing.publishedAt = nowIso()
        state.community.cards = state.community.cards.filter((c) => c.deckId !== existing.id)
        snapshot.forEach((c, i) => state.community.cards.push({ id: `${existing.id}_v${pub.version}_c${i + 1}`, deckId: existing.id, type: c.type, front: c.front, back: c.back, media: c.media || null, lang: c.lang || 'pt-BR', translation: null }))
      } else {
        const cid = `c_${pub.deckId}`
        state.community.decks.push({ id: cid, authorId: author.id, name: pub.deckName, categoryId: pub.categoryId, difficulty: pub.difficulty, lang: 'pt-BR', version: pub.version, publishedAt: nowIso(), description: '', tags: deck?.tags || [], stats: { studiedWeek: 0, votes: 0, favorites: 0, comments: 0, clones: 0 }, reactions: { '👏': 0, '🔥': 0, '🧠': 0, '💡': 0, '❤️': 0, '😂': 0 }, publicId: pub.publicId, clonedFrom: null })
        snapshot.forEach((c, i) => state.community.cards.push({ id: `${cid}_c${i + 1}`, deckId: cid, type: c.type, front: c.front, back: c.back, media: c.media || null, lang: c.lang || 'pt-BR', translation: null }))
      }
    } else if (deck) {
      deck.publication = { ...(deck.publication || {}), status: deck.publication?.status === 'aprovado' ? 'aprovado' : 'rejeitado', pendingVersion: null, lastRejection: { reasonCategory, excerpt, appealDeadline: pub.decision.appealDeadline } }
    }
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: `publication_${decision}`, target: pub.id, details: { reasonCategory: reasonCategory || null } })
    res.json({ publication: { ...pub, snapshot: undefined, sla: slaInfo(pub) } })
  })

  r.post('/moderation/reports/:id/resolve', only('moderador'), (req, res) => {
    const state = req.store.state
    const report = state.reports.find((x) => x.id === req.params.id)
    if (!report) return fail(res, 404, 'not_found', 'Denúncia não encontrada.')
    const { action, reason, durationDays } = req.body || {}
    if (!['manter', 'remover', 'silenciar', 'banir'].includes(action)) return fail(res, 422, 'validation', 'Ação inválida.')
    if (action !== 'manter' && !reason?.trim()) return fail(res, 422, 'validation', 'Toda punição vem com motivo.')
    report.status = 'resolvida'
    report.resolution = { action, reason: reason || null, durationDays: durationDays || null, by: req.user.id, at: nowIso(), appealChannel: 'Contestação em até 30 dias, revisada por moderador diferente.' }
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: `report_${action}`, target: report.id, details: { reason: reason || null, durationDays: durationDays || null } })
    res.json({ report })
  })

  r.post('/moderation/appeals/:id/decide', only('moderador'), (req, res) => {
    const state = req.store.state
    const appeal = state.appeals.find((x) => x.id === req.params.id)
    if (!appeal) return fail(res, 404, 'not_found', 'Contestação não encontrada.')
    if (appeal.originalReviewer === req.user.id) return fail(res, 403, 'same_reviewer', 'A contestação precisa ser revisada por um moderador diferente do original.')
    const { decision, note } = req.body || {}
    if (!['aceita', 'mantida'].includes(decision)) return fail(res, 422, 'validation', 'Decisão inválida.')
    appeal.status = decision
    appeal.decidedAt = nowIso()
    appeal.decidedBy = req.user.id
    appeal.note = note || null
    if (decision === 'aceita') {
      const pub = state.publications.find((p) => p.id === appeal.publicationId)
      if (pub) { pub.status = 'em_revisao'; pub.decidedAt = null; pub.decision = null; pub.assignedTo = req.user.id }
    }
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: `appeal_${decision}`, target: appeal.id, details: {} })
    res.json({ appeal })
  })

  r.get('/support/search', only('suporte_n1', 'suporte_n2', 'compliance'), (req, res) => {
    const state = req.store.state
    const q = String(req.query.q || '').toLowerCase()
    const users = state.users.filter((u) => u.role === 'student' && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))).map((u) => ({ id: u.id, name: u.name, email: mask(u.email, 2), plan: u.plan, isMinor: u.isMinor }))
    res.json({ users })
  })

  r.post('/support/users/:id/view-as', only('suporte_n1', 'suporte_n2', 'compliance'), (req, res) => {
    const state = req.store.state
    const user = state.users.find((u) => u.id === req.params.id && u.role === 'student')
    if (!user) return fail(res, 404, 'not_found', 'Conta não encontrada.')
    const { purpose, consentReference } = req.body || {}
    if (!purpose?.trim() || !consentReference?.trim()) return fail(res, 422, 'validation', 'Informe a finalidade e a referência do consentimento do usuário.')
    recordAccess(state, { operator: req.user.id, operatorRole: req.session.role, subjectUserId: user.id, purpose, fields: ['perfil', 'estudo', 'carteira', 'assinatura (parcial)', 'janela de silêncio'] })
    const study = state.study[user.id]
    const sub = state.subscriptions[user.id]
    res.json({
      mode: 'ver_como_somente_leitura',
      consent: { reference: consentReference, recordedAt: nowIso() },
      account: { id: user.id, name: user.name, email: mask(user.email, 2), phone: mask(user.phone, 6), plan: user.plan, isMinor: user.isMinor, verified: user.verified, createdAt: user.createdAt, ageVerification: { status: user.ageVerification?.status, method: user.ageVerification?.method, documents: 'não acessíveis (apagados em 24 h)' } },
      study: { streak: study.streak, goal: study.goal, doneToday: study.doneToday, reschedules: study.reschedules, pausedUntil: study.pausedUntil, studyDays: study.studyDays },
      wallet: { balance: balanceOf(state, user.id), coupons: state.myCoupons.filter((m) => m.userId === user.id).length },
      subscription: sub ? { plan: sub.plan, cycle: sub.cycle || null, method: sub.method || null, lastPayment: sub.payments?.slice(-1)[0] ? { at: sub.payments.slice(-1)[0].at, status: sub.payments.slice(-1)[0].status, card: 'dados completos não acessíveis' } : null } : null,
      notifications: state.notifications[user.id],
      quietWindowInferred: state.notifications[user.id].quietWindow,
      tickets: state.support.tickets.filter((t) => t.userId === user.id)
    })
  })

  r.get('/support/tickets', only('suporte_n1', 'suporte_n2', 'compliance'), (req, res) => {
    res.json({ tickets: req.store.state.support.tickets, sla: { humanResponseHours: 24, minorSuspicionHours: 4 } })
  })

  r.post('/support/tickets/:id/reply', only('suporte_n1', 'suporte_n2'), (req, res) => {
    const ticket = req.store.state.support.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return fail(res, 404, 'not_found', 'Chamado não encontrado.')
    const { text, close } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Escreva a resposta.')
    ticket.replies.push({ by: req.user.name, text: text.trim(), at: nowIso() })
    ticket.status = close ? 'resolvido' : 'respondido'
    ticket.updatedAt = nowIso()
    res.json({ ticket })
  })

  r.get('/commercial/overview', only('comercial'), (req, res) => {
    const state = req.store.state
    const partners = state.partner.partners.map((p) => ({ ...p, campaigns: state.coupons.filter((c) => c.partnerId === p.id).map((c) => ({ id: c.id, title: c.title, stock: c.stock, costNeurons: c.costNeurons, positioning: c.positioning })), redemptions: state.partner.redemptions.filter((x) => x.partnerId === p.id).length }))
    res.json({ partners, alerts: state.admin.commercialAlerts, positioningTable: state.partner.positioningTable, churnRisk: state.admin.churnRisk, dashboard: { activePartners: partners.filter((p) => p.verified).length, redemptions30d: 1180, confirmedUse30d: 764, cpaRevenueBRL: 1416, positioningRevenueBRL: 1600 } })
  })

  r.post('/commercial/partners/:id/approve-stage', only('comercial'), (req, res) => {
    const state = req.store.state
    const partner = state.partner.partners.find((p) => p.id === req.params.id)
    if (!partner) return fail(res, 404, 'not_found', 'Parceiro não encontrado.')
    partner.approvalStages = partner.approvalStages || []
    if (partner.approvalStages.length === 0) partner.approvalStages.push('Documentação validada')
    else if (partner.approvalStages.length === 1) { partner.approvalStages.push('Aprovação comercial'); partner.verified = true }
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'partner_stage_approved', target: partner.id, details: { stages: partner.approvalStages } })
    res.json({ partner })
  })

  r.get('/finance/overview', only('financeiro'), (req, res) => {
    const state = req.store.state
    const own = Object.entries(state.subscriptions).flatMap(([userId, s]) => (s.payments || []).map((p) => ({ ...p, userId, plan: s.plan, cycle: s.cycle || null })))
    const synthetic = Array.from({ length: 8 }, (_, i) => ({ id: `pay_s${i}`, userId: `u${20 + i}`, at: daysFromNow(-(i * 3 + 1)), amountBRL: i % 4 === 0 ? 239.9 : 29.9, method: ['Cartão de crédito', 'Pix Automático', 'Boleto', 'Pix avulso'][i % 4], status: i === 5 ? 'falhou' : i === 6 ? 'reembolsado' : 'pago', nfse: i === 5 ? null : { number: `NFS-e 2026/${String(300 + i).padStart(5, '0')}`, availableAt: daysFromNow(-(i * 3)), url: '#' }, plan: 'premium', cycle: i % 4 === 0 ? 'anual' : 'mensal' }))
    const payments = [...own, ...synthetic].sort((a, b) => b.at.localeCompare(a.at))
    res.json({ payments, summary: { mrrBRL: 4820, activePremium: 161, refunds30d: 2, dunning: 3, nfseSlaHours: 48, fiscalRetentionYears: 5 }, dunningPolicy: '3 tentativas em 7 dias + 3 dias de graça, depois downgrade preservando os decks.' })
  })

  r.get('/compliance/overview', only('compliance'), (req, res) => {
    const state = req.store.state
    res.json({
      auditLog: state.auditLog.slice().reverse().slice(0, 100),
      chain: verifyChain(state.auditLog),
      accessLog: state.accessLog.slice().reverse(),
      incidents: state.admin.incidents,
      dpo: state.admin.dpo,
      policy: state.admin.policy,
      retention: { auditYears: 5, documentsHours: 24, originalsDays: 30, fiscalYears: 5 },
      decisionsContested: state.noa.decisions.filter((d) => d.contested).length,
      consciousDecisions: [{ topic: 'Tom provocativo das notificações', decision: 'Mantido com escala de intensidade por usuário, menor travado em "leve" e opt-in por categoria no WhatsApp.', recordedAt: daysFromNow(-1) }]
    })
  })

  r.post('/compliance/incidents', only('compliance'), (req, res) => {
    const state = req.store.state
    const { title, affectedUserIds = [] } = req.body || {}
    if (!title?.trim()) return fail(res, 422, 'validation', 'Dê um título ao incidente.')
    const affected = state.users.filter((u) => u.role === 'student' && (affectedUserIds.length === 0 || affectedUserIds.includes(u.id)))
    const incident = { id: id('inc'), title: title.trim(), detectedAt: nowIso(), status: 'aberto', affected: affected.length, minorsAffected: affected.filter((u) => u.isMinor).length, anpdDeadline: hoursFromNow(72), holdersDeadline: hoursFromNow(72), anpdNotifiedAt: null, holdersNotifiedAt: null, runbook: 'RB-SEC-01' }
    state.admin.incidents.unshift(incident)
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'incident_opened', target: incident.id, details: { affected: incident.affected, minors: incident.minorsAffected } })
    res.status(201).json({ incident, tools: { listAffected: `/v1/admin/compliance/incidents/${incident.id}/affected` } })
  })

  r.get('/compliance/incidents/:id/affected', only('compliance'), (req, res) => {
    const state = req.store.state
    const incident = state.admin.incidents.find((x) => x.id === req.params.id)
    if (!incident) return fail(res, 404, 'not_found', 'Incidente não encontrado.')
    const affected = state.users.filter((u) => u.role === 'student').map((u) => ({ id: u.id, name: u.name, isMinor: u.isMinor, email: mask(u.email, 2) }))
    res.json({ incident, affected, total: affected.length, minors: affected.filter((u) => u.isMinor).length })
  })

  r.post('/compliance/incidents/:id/notify', only('compliance'), (req, res) => {
    const state = req.store.state
    const incident = state.admin.incidents.find((x) => x.id === req.params.id)
    if (!incident) return fail(res, 404, 'not_found', 'Incidente não encontrado.')
    const { target } = req.body || {}
    if (target === 'anpd') incident.anpdNotifiedAt = nowIso()
    else if (target === 'titulares') incident.holdersNotifiedAt = nowIso()
    else return fail(res, 422, 'validation', 'Alvo inválido.')
    if (incident.anpdNotifiedAt && incident.holdersNotifiedAt) incident.status = 'comunicado'
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: `incident_notified_${target}`, target: incident.id, details: {} })
    res.json({ incident })
  })

  r.get('/engineering/overview', only('engenharia'), (req, res) => {
    const state = req.store.state
    res.json({
      flags: state.admin.flags,
      aiCosts: state.admin.aiCosts,
      noaQuality: state.admin.noaQuality,
      notificationTemplates: state.admin.notificationTemplates.map((tpl) => ({ ...tpl, disabled: tpl.disabled || tpl.optOut > state.admin.notificationOptOutLimit })),
      notificationOptOutLimit: state.admin.notificationOptOutLimit,
      antifraud: state.antifraud || [],
      slo: { studyP95Ms: 172, studyP99Ms: 431, targetP95Ms: 200, targetP99Ms: 500, concurrent: 10000, ingestionPerSec: 1500, generationP50Sec: 41, generationP95Sec: 98, availabilityCore: 99.71, availabilityOther: 99.2, rpoMinutes: 15, rtoHours: 2, lastRestoreTest: daysFromNow(-12) },
      environments: ['dev', 'homologação', 'produção'],
      rollbackMinutes: 10,
      regions: { data: 'Brasil', ai: 'São Paulo (Bedrock / Vertex) quando disponível; fallback API direta com cláusulas-padrão ANPD', pseudonymization: true },
      queues: { generation: { premium: 0, free: 2, deadLetter: state.generation.jobs.filter((j) => j.deadLetter).length } }
    })
  })

  r.patch('/engineering/flags/:key', only('engenharia'), (req, res) => {
    const state = req.store.state
    const flag = state.admin.flags.find((f) => f.key === req.params.key)
    if (!flag) return fail(res, 404, 'not_found', 'Flag não encontrada.')
    if (typeof req.body?.on === 'boolean') flag.on = req.body.on
    if (typeof req.body?.kill === 'boolean') { flag.kill = req.body.kill; if (flag.kill) flag.on = false }
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'flag_changed', target: flag.key, details: { on: flag.on, kill: flag.kill } })
    res.json({ flag })
  })

  return r
}
