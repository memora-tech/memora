import { Router } from 'express'
import { createSession, requireRole } from '../lib/auth.js'
import { fail, ownDecksOf, deckProgress, categoryName } from '../lib/helpers.js'
import { nowIso } from '../lib/ids.js'
import { appendAudit } from '../lib/audit.js'

const PERMISSION_KEYS = ['community', 'publicLink', 'externalMembers', 'schoolShare', 'whatsappInfo']

const requireGuardian = requireRole('guardian')

export function parentalRoutes() {
  const r = Router()

  r.post('/auth/login', (req, res) => {
    const state = req.store.state
    const { email, password } = req.body || {}
    if (!email || !password) return fail(res, 422, 'invalid_credentials', 'Informe e-mail e senha.')
    const guardian = state.users.find((u) => u.role === 'guardian')
    const session = createSession(state, { userId: guardian.id, role: 'guardian', device: 'Painel Parental · Navegador' })
    res.json({ token: session.token, user: { id: guardian.id, name: state.parental.guardian.name, email: state.parental.guardian.email, role: 'guardian' } })
  })

  r.get('/overview', requireGuardian, (req, res) => {
    const state = req.store.state
    const decks = ownDecksOf(state, 'u1').map((d) => ({ id: d.id, name: d.name, categoryName: categoryName(state, d.categoryId), lastStudiedAt: d.lastStudiedAt, progress: deckProgress(state, d) }))
    res.json({
      guardian: state.parental.guardian,
      child: { ...state.parental.child, streak: state.study.u1.streak, studyDays: state.study.u1.studyDays, notificationIntensity: 'leve', quietWindow: { start: '21:00', end: '07:00' } },
      permissions: state.parental.permissions,
      permissionLabels: {
        community: { label: 'Liberar comunidade', help: 'Seguir, comentar e ser seguido por outros alunos.' },
        publicLink: { label: 'Liberar link público de deck', help: 'Enviar decks por WhatsApp ou Instagram. Quem recebe precisa entrar para estudar.' },
        externalMembers: { label: 'Liberar membros externos em pastas', help: 'Convidar pessoas de fora da família para pastas compartilhadas.' },
        schoolShare: { label: 'Compartilhar desempenho com a escola', help: 'A escola vê o progresso individual só com esta liberação.' },
        whatsappInfo: { label: 'Liberar WhatsApp informativo', help: 'Notícias sobre memória e educação, 2 vezes por semana.' },
        notificationWindow: { label: 'Janela de notificação', help: 'Fora deste horário nenhuma notificação chega ao aluno.' }
      },
      requests: state.parental.requests,
      weeklySummary: state.parental.weeklySummary,
      decks,
      history: state.parental.history,
      gamification: { note: 'Cupons e Neurônios funcionam igual para menores e adultos, sem restrição do responsável.', balance: state.ledger.filter((e) => e.userId === 'u1').slice(-1)[0]?.balanceAfter ?? 0 },
      milestones: [{ age: 16, text: 'Aos 16, o aluno passa a gerir a própria comunidade; você continua acompanhando.' }, { age: 18, text: 'Aos 18, a transição para conta adulta é automática. Você só recebe um aviso.' }]
    })
  })

  r.patch('/permissions', requireGuardian, (req, res) => {
    const state = req.store.state
    const body = req.body || {}
    const changed = []
    for (const key of PERMISSION_KEYS) {
      if (typeof body[key] === 'boolean' && state.parental.permissions[key] !== body[key]) {
        state.parental.permissions[key] = body[key]
        changed.push(key)
        state.parental.requests.forEach((rq) => { if (rq.type === key && rq.status === 'pendente' && body[key]) { rq.status = 'aprovada'; rq.decidedAt = nowIso() } })
      }
    }
    if (body.notificationWindow?.start && body.notificationWindow?.end) {
      state.parental.permissions.notificationWindow = { start: body.notificationWindow.start, end: body.notificationWindow.end }
      changed.push('notificationWindow')
    }
    if (changed.length) {
      state.parental.history.unshift({ at: nowIso(), text: `Você alterou: ${changed.join(', ')}.` })
      appendAudit(state, { actor: req.user.id, actorRole: 'guardian', action: 'guardian_permissions_changed', target: 'u1', details: { changed } })
    }
    res.json({ permissions: state.parental.permissions, requests: state.parental.requests, changed })
  })

  r.post('/requests/:id/decide', requireGuardian, (req, res) => {
    const state = req.store.state
    const request = state.parental.requests.find((x) => x.id === req.params.id)
    if (!request) return fail(res, 404, 'not_found', 'Solicitação não encontrada.')
    const approve = Boolean(req.body?.approve)
    request.status = approve ? 'aprovada' : 'negada'
    request.decidedAt = nowIso()
    if (approve && PERMISSION_KEYS.includes(request.type)) state.parental.permissions[request.type] = true
    state.parental.history.unshift({ at: nowIso(), text: `Você ${approve ? 'aprovou' : 'negou'} "${request.title}".` })
    appendAudit(state, { actor: req.user.id, actorRole: 'guardian', action: approve ? 'guardian_request_approved' : 'guardian_request_denied', target: request.id, details: { type: request.type } })
    res.json({ request, permissions: state.parental.permissions })
  })

  return r
}
