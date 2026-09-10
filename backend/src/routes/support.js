import { Router } from 'express'
import { requireStudent } from '../lib/auth.js'
import { fail } from '../lib/helpers.js'
import { id, nowIso } from '../lib/ids.js'

export function supportRoutes() {
  const r = Router()

  r.get('/support/tickets', requireStudent, (req, res) => {
    const tickets = req.store.state.support.tickets.filter((t) => t.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json({ tickets, channels: ['chat', 'formulario'], sla: 'Resposta humana em até 24 h; suspeita envolvendo menor em até 4 h.' })
  })

  r.post('/support/tickets', requireStudent, (req, res) => {
    const { subject, message, channel = 'formulario' } = req.body || {}
    if (!subject?.trim() || !message?.trim()) return fail(res, 422, 'validation', 'Assunto e mensagem são obrigatórios.')
    const ticket = { id: id('tk'), userId: req.user.id, subject: subject.trim(), message: message.trim(), channel, status: 'aberto', createdAt: nowIso(), updatedAt: nowIso(), replies: [] }
    req.store.state.support.tickets.unshift(ticket)
    res.status(201).json({ ticket })
  })

  r.post('/support/tickets/:id/messages', requireStudent, (req, res) => {
    const ticket = req.store.state.support.tickets.find((t) => t.id === req.params.id && t.userId === req.user.id)
    if (!ticket) return fail(res, 404, 'not_found', 'Chamado não encontrado.')
    const { text } = req.body || {}
    if (!text?.trim()) return fail(res, 422, 'validation', 'Escreva a mensagem.')
    ticket.replies.push({ by: req.user.name, text: text.trim(), at: nowIso(), mine: true })
    ticket.updatedAt = nowIso()
    ticket.status = 'aberto'
    res.json({ ticket })
  })

  return r
}
