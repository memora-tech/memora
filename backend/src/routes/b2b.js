import { Router } from 'express'
import { createSession, requireRole } from '../lib/auth.js'
import { fail } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const ROLES = ['admin', 'coordenador', 'professor', 'leitura']
const requireB2B = requireRole(...ROLES.map((x) => `b2b_${x}`))

function roleOf(req) {
  return req.session.role.replace('b2b_', '')
}

function classView(state, klass, role) {
  const consented = klass.students.filter((s) => s.consent && s.projectionActive)
  const canAggregate = consented.length >= state.b2b.minAggregate
  const aggregates = canAggregate
    ? {
        activeStudents: consented.length,
        avgAccuracy: Math.round(consented.reduce((n, s) => n + s.metrics.accuracy, 0) / consented.length),
        avgCardsWeek: Math.round(consented.reduce((n, s) => n + s.metrics.cardsWeek, 0) / consented.length),
        studiedLast7Days: consented.filter((s) => new Date(s.metrics.lastStudy).getTime() > Date.now() - 7 * 86400000).length
      }
    : null
  const teacher = state.b2b.users.find((u) => u.id === klass.teacherId)
  const showIndividual = role === 'professor' || role === 'coordenador' || role === 'admin'
  return {
    id: klass.id,
    name: klass.name,
    year: klass.year,
    semester: klass.semester,
    subject: klass.subject,
    room: klass.room,
    teacherName: teacher?.name,
    total: klass.students.length,
    consented: consented.length,
    minAggregate: state.b2b.minAggregate,
    aggregates,
    aggregateBlockedReason: canAggregate ? null : `Agregados exigem ao menos ${state.b2b.minAggregate} alunos com consentimento. Esta turma tem ${consented.length}. Só a visão individual consentida está disponível.`,
    students: showIndividual ? klass.students.map((s) => ({ id: s.id, name: s.name, consent: s.consent, projectionActive: s.projectionActive, metrics: s.consent && s.projectionActive ? s.metrics : null })) : null,
    noRanking: true
  }
}

export function b2bRoutes() {
  const r = Router()

  r.post('/auth/login', (req, res) => {
    const state = req.store.state
    const { provider = 'google', role = 'coordenador' } = req.body || {}
    if (!ROLES.includes(role)) return fail(res, 422, 'validation', 'Papel inválido.', { roles: ROLES })
    const user = state.users.find((u) => u.role === `b2b_${role}`)
    const session = createSession(state, { userId: user.id, role: `b2b_${role}`, device: `Painel B2B · SSO ${provider === 'microsoft' ? 'Microsoft Entra' : 'Google Workspace'}` })
    res.json({ token: session.token, user: { id: user.id, name: user.name, email: user.email, role, tenantId: 't1', tenantName: state.b2b.tenant.name }, sso: provider })
  })

  r.get('/overview', requireB2B, (req, res) => {
    const state = req.store.state
    const role = roleOf(req)
    const classes = state.b2b.classes.map((k) => classView(state, k, role))
    res.json({
      tenant: state.b2b.tenant,
      me: { id: req.user.id, name: req.user.name, role },
      roles: ROLES,
      classes,
      indicators: role === 'coordenador' || role === 'admin' ? state.b2b.indicators : null,
      invites: state.b2b.invites,
      users: role === 'admin' ? state.b2b.users : null,
      rules: { minAggregate: state.b2b.minAggregate, noRankingBetweenStudents: true, individualRequiresConsent: true, projectionRevocable: true, isolation: state.b2b.tenant.isolation, api: 'Fase posterior: API de leitura por tenant' }
    })
  })

  r.get('/classes/:id', requireB2B, (req, res) => {
    const state = req.store.state
    const klass = state.b2b.classes.find((k) => k.id === req.params.id)
    if (!klass) return fail(res, 404, 'not_found', 'Turma não encontrada.')
    res.json({ class: classView(state, klass, roleOf(req)) })
  })

  r.post('/invites', requireB2B, (req, res) => {
    const state = req.store.state
    const role = roleOf(req)
    if (!['admin', 'coordenador', 'professor'].includes(role)) return fail(res, 403, 'forbidden', 'Seu papel não convida alunos.')
    const { contact, classId, method = 'e-mail' } = req.body || {}
    if (!contact?.trim() || !classId) return fail(res, 422, 'validation', 'Contato e turma são obrigatórios.')
    const minor = /aluno|estudante|menor/i.test(contact) || method === 'código de turma' ? null : /\d{2}\.\d{2}\.\d{4}/.test(contact)
    const invite = { id: id('inv'), contact: contact.trim(), classId, method, status: 'pendente', minor: minor === null ? null : Boolean(minor), guardianStatus: minor ? 'aguardando responsável' : null, sentAt: nowIso() }
    state.b2b.invites.unshift(invite)
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'b2b_invite_sent', target: classId, details: { method } })
    res.status(201).json({ invite, acceptance: 'O aluno aceita o convite no app; se tiver menos de 16 anos, o responsável também aceita no painel parental.' })
  })

  r.post('/students/:id/revoke', requireB2B, (req, res) => {
    const state = req.store.state
    const role = roleOf(req)
    if (!['admin', 'coordenador'].includes(role)) return fail(res, 403, 'forbidden', 'Só administrador ou coordenador revoga projeções.')
    for (const klass of state.b2b.classes) {
      const student = klass.students.find((s) => s.id === req.params.id)
      if (student) {
        student.projectionActive = false
        student.consent = false
        appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'b2b_projection_revoked', target: student.id, details: { classId: klass.id } })
        return res.json({ student: { id: student.id, name: student.name, consent: false, projectionActive: false }, note: 'Inclusão cortada imediatamente; o aluno saiu das visões individuais. Agregados já entregues permanecem.' })
      }
    }
    return fail(res, 404, 'not_found', 'Aluno não encontrado.')
  })

  r.get('/export', requireB2B, (req, res) => {
    const state = req.store.state
    const role = roleOf(req)
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv'
    const rows = [['turma', 'materia', 'alunos', 'consentidos', 'acuracia_media', 'cards_semana_media']]
    for (const k of state.b2b.classes) {
      const v = classView(state, k, role)
      rows.push([v.name, v.subject, v.total, v.consented, v.aggregates?.avgAccuracy ?? 'suprimido', v.aggregates?.avgCardsWeek ?? 'suprimido'])
    }
    const csv = rows.map((row) => row.join(';')).join('\n')
    appendAudit(state, { actor: req.user.id, actorRole: req.session.role, action: 'b2b_export', target: 't1', details: { format } })
    res.json({ fileName: `colegio-horizonte-indicadores.${format}`, url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`, rows: rows.length - 1, note: format === 'xlsx' ? 'No protótipo, o XLSX é entregue como CSV.' : null })
  })

  r.get('/users', requireB2B, (req, res) => {
    if (roleOf(req) !== 'admin') return fail(res, 403, 'forbidden', 'Só o administrador da instituição vê os usuários.')
    res.json({ users: req.store.state.b2b.users })
  })

  return r
}
