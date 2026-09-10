import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { B2BArea } from './B2BArea.jsx'
import { ToastProvider } from '../../design-system/index.js'

const students = (prefix, total, consented) =>
  Array.from({ length: total }, (_, i) => ({
    id: `${prefix}_s${i + 1}`,
    name: `Aluno ${prefix} ${i + 1}`,
    consent: i < consented,
    projectionActive: i < consented,
    metrics: i < consented ? { cardsWeek: 200 - i * 10, accuracy: 60 + i, streak: i, lastStudy: '2026-09-08T12:00:00.000Z' } : null
  }))

const classK1 = {
  id: 'k1',
  name: '3º A',
  year: 2026,
  semester: 2,
  subject: 'Biologia',
  room: 'Sala 12',
  teacherName: 'Jonas Pereira',
  total: 28,
  consented: 24,
  minAggregate: 10,
  aggregates: { activeStudents: 24, avgAccuracy: 77, avgCardsWeek: 120, studiedLast7Days: 20 },
  aggregateBlockedReason: null,
  students: students('k1', 4, 4),
  noRanking: true
}

const classK2 = {
  id: 'k2',
  name: '3º B',
  year: 2026,
  semester: 2,
  subject: 'Biologia',
  room: 'Sala 14',
  teacherName: 'Jonas Pereira',
  total: 26,
  consented: 9,
  minAggregate: 10,
  aggregates: null,
  aggregateBlockedReason: 'Agregados exigem ao menos 10 alunos com consentimento. Esta turma tem 9. Só a visão individual consentida está disponível.',
  students: students('k2', 4, 2),
  noRanking: true
}

const overview = {
  tenant: { id: 't1', name: 'Colégio Horizonte', cnpj: '45.678.901/0001-22', sso: 'Google Workspace', dpa: { signedAt: '2026-07-10T12:00:00.000Z', version: 'DPA v1.2', status: 'ativo' }, isolation: 'Row-Level Security por tenant_id', plan: 'Licença anual · 400 alunos' },
  me: { id: 'b2', name: 'Marta Lins', role: 'coordenador' },
  roles: ['admin', 'coordenador', 'professor', 'leitura'],
  classes: [classK1, classK2],
  indicators: { byTeacher: [], bySubject: [], bySemester: [], byYear: [] },
  invites: [],
  users: null,
  rules: { minAggregate: 10, noRankingBetweenStudents: true, individualRequiresConsent: true, projectionRevocable: true, isolation: 'RLS', api: 'Fase posterior' }
}

function respond(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function mockFetch() {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const path = String(url)
    const method = opts.method || 'GET'
    if (method === 'POST' && path.endsWith('/v1/b2b/auth/login')) {
      const body = JSON.parse(opts.body)
      return respond({ token: 'tok_b2b', user: { id: 'b2', name: 'Marta Lins', role: body.role, tenantId: 't1', tenantName: 'Colégio Horizonte' }, sso: body.provider })
    }
    if (method === 'GET' && path.endsWith('/v1/b2b/overview')) return respond(overview)
    if (method === 'GET' && path.endsWith('/v1/b2b/classes/k2')) return respond({ class: classK2 })
    if (method === 'GET' && path.endsWith('/v1/b2b/classes/k1')) return respond({ class: classK1 })
    return respond({ code: 'not_found', message: 'rota não mockada' }, 404)
  })
}

function renderArea(entry = '/b2b/login') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/b2b/*" element={<B2BArea />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('Painel B2B', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('faz login por SSO e mostra a instituição com o status do DPA', async () => {
    const user = userEvent.setup()
    renderArea()
    await user.click(screen.getByRole('button', { name: /Entrar com Google Workspace/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Colégio Horizonte' })).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/b2b/auth/login'), expect.objectContaining({ method: 'POST' }))
    expect(screen.getByText(/DPA v1.2/)).toBeInTheDocument()
    expect(screen.getByText(/Row-Level Security por tenant_id/)).toBeInTheDocument()
  })

  it('turma com menos de 10 consentidos mostra o motivo do bloqueio e nenhum ranking', async () => {
    const user = userEvent.setup()
    renderArea()
    await user.click(screen.getByRole('button', { name: /Entrar com Google Workspace/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '3º B' })).toBeInTheDocument())
    expect(screen.getByText(/Esta turma tem 9/)).toBeInTheDocument()
    expect(screen.getByText(/Não existe ranking entre alunos da mesma turma/)).toBeInTheDocument()
    expect(screen.queryByText(/posição/i)).toBeNull()
  })

  it('detalhe da turma lista alunos na ordem de matrícula, sem coluna de posição', async () => {
    const user = userEvent.setup()
    renderArea()
    await user.click(screen.getByRole('button', { name: /Entrar com Google Workspace/i }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Abrir turma/i }).length).toBe(2))
    await user.click(screen.getAllByRole('button', { name: /Abrir turma/i })[1])
    await waitFor(() => expect(screen.getByRole('heading', { name: /Turma 3º B/ })).toBeInTheDocument())
    const table = screen.getByRole('table', { name: /ordem de matrícula/i })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Aluno k2 1', 'Aluno k2 2', 'Aluno k2 3', 'Aluno k2 4'])
    expect(within(table).queryByRole('columnheader', { name: /posição|ranking/i })).toBeNull()
    expect(within(rows[2]).getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Revogar projeção/i }).length).toBe(2)
  })
})
