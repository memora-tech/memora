import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ParentalArea } from './ParentalArea.jsx'
import { parentalApi } from '../../lib/api.js'

const overview = {
  guardian: { id: 'g1', name: 'Patrícia Alves', email: 'p@x.com', phone: '+55', verified: true, verifiedAt: '2026-08-05T12:00:00.000Z', method: 'documento + prova de vida', provider: 'Verificador homologado' },
  child: { id: 'u1', name: 'Lucas Alves', age: 15, birthDate: '2011-03-22', verifiedAt: '2026-08-05T12:00:00.000Z', documentDeletedAt: '2026-08-06T10:00:00.000Z', documentHash: '9f1c…e2a7', verifiedBy: 'Verificador homologado', streak: 6, studyDays: 6, notificationIntensity: 'leve', quietWindow: { start: '21:00', end: '07:00' } },
  permissions: { community: false, publicLink: false, externalMembers: false, schoolShare: false, whatsappInfo: false, notificationWindow: { start: '21:00', end: '07:00' } },
  permissionLabels: {
    community: { label: 'Liberar comunidade', help: 'Seguir, comentar e ser seguido.' },
    publicLink: { label: 'Liberar link público de deck', help: 'Enviar decks por link.' },
    externalMembers: { label: 'Liberar membros externos em pastas', help: 'Convidar pessoas de fora.' },
    schoolShare: { label: 'Compartilhar desempenho com a escola', help: 'A escola vê o progresso.' },
    whatsappInfo: { label: 'Liberar WhatsApp informativo', help: 'Notícias 2 vezes por semana.' },
    notificationWindow: { label: 'Janela de notificação', help: 'Fora deste horário nada chega.' }
  },
  requests: [{ id: 'req1', type: 'community', title: 'Liberar comunidade', detail: 'Lucas quer seguir uma criadora.', createdAt: '2026-09-09T05:00:00.000Z', status: 'pendente' }],
  weeklySummary: { weekOf: '2026-09-03T12:00:00.000Z', studyDays: 5, cards: 132, minutes: 48, accuracy: 78, streak: 6, subjects: [{ name: 'Citologia', cards: 54, accuracy: 81 }], milestones: [] },
  decks: [{ id: 'd2', name: 'Citologia', categoryName: 'Vestibular/ENEM', lastStudiedAt: '2026-09-07T12:00:00.000Z', progress: { total: 6, due: 5, mastered: 0, learning: 6, offlineAvailable: true, offlineReason: 'recente' } }],
  history: [{ at: '2026-09-06T12:00:00.000Z', text: 'Você negou "Liberar membros externos em pastas".' }],
  gamification: { note: 'Cupons e Neurônios funcionam igual para menor e adulto, sem restrição do responsável.', balance: 148 },
  milestones: [{ age: 16, text: 'Aos 16, o aluno passa a gerir a própria comunidade.' }, { age: 18, text: 'Aos 18, a transição é automática.' }]
}

function mockFetch(extra = {}) {
  const calls = []
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET'
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ method, url, body })
    const respond = (status, payload) => ({ ok: status < 400, status, json: async () => payload })
    if (method === 'POST' && url === '/v1/parental/auth/login') return respond(200, { token: 'tok_g1', user: { id: 'g1', name: 'Patrícia Alves', role: 'guardian' } })
    if (method === 'GET' && url === '/v1/parental/overview') return respond(200, overview)
    if (method === 'PATCH' && url === '/v1/parental/permissions') return respond(200, { permissions: { ...overview.permissions, ...body }, requests: overview.requests, changed: Object.keys(body) })
    if (method === 'POST' && url === '/v1/parental/requests/req1/decide') return respond(200, { request: { ...overview.requests[0], status: body.approve ? 'aprovada' : 'negada', decidedAt: '2026-09-09T10:00:00.000Z' }, permissions: { ...overview.permissions, community: Boolean(body.approve) } })
    if (extra[`${method} ${url}`]) return extra[`${method} ${url}`](body)
    return respond(404, { code: 'not_found' })
  })
  return calls
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/parental/*" element={<ParentalArea />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  parentalApi.setToken(null)
})

describe('Painel Parental', () => {
  it('login leva ao painel e mostra a conta do menor', async () => {
    const calls = mockFetch()
    renderAt('/parental/login')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'patricia@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByText('Lucas Alves')).toBeInTheDocument())
    expect(calls.some((c) => c.url === '/v1/parental/auth/login')).toBe(true)
    expect(parentalApi.getToken()).toBe('tok_g1')
    expect(screen.getByText('Resumo da semana')).toBeInTheDocument()
    expect(screen.getByText(/Documentos apagados em/)).toBeInTheDocument()
  })

  it('permissões renderizam como switches independentes', async () => {
    mockFetch()
    parentalApi.setToken('tok_g1')
    renderAt('/parental/painel/permissoes')
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Liberar comunidade' })).toBeInTheDocument())
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(5)
    expect(screen.getByRole('switch', { name: 'Liberar comunidade' })).toHaveAttribute('aria-checked', 'false')
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Liberar comunidade' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Liberar comunidade' })).toHaveAttribute('aria-checked', 'true'))
    expect(global.fetch).toHaveBeenCalledWith('/v1/parental/permissions', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ community: true }) }))
  })

  it('aprovar uma solicitação chama a rota certa e libera a permissão', async () => {
    const calls = mockFetch()
    parentalApi.setToken('tok_g1')
    renderAt('/parental/painel/solicitacoes')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url === '/v1/parental/requests/req1/decide' && c.body.approve === true)).toBe(true))
    await waitFor(() => expect(screen.getByText('Aprovada')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('negar pede confirmação antes de registrar', async () => {
    const calls = mockFetch()
    parentalApi.setToken('tok_g1')
    renderAt('/parental/painel/solicitacoes')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Negar' })).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Negar' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Negar' }))
    await waitFor(() => expect(calls.some((c) => c.url === '/v1/parental/requests/req1/decide' && c.body.approve === false)).toBe(true))
  })
})
