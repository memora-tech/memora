import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminArea } from './AdminArea.jsx'
import { ToastProvider } from '../../design-system/index.js'

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600000).toISOString()

const pub2 = {
  id: 'pub2',
  deckId: 'd2',
  authorId: 'u1',
  authorName: 'Manoel',
  deckName: 'Citologia',
  version: 1,
  status: 'em_triagem',
  plan: 'free',
  submittedAt: hoursAgo(30),
  decidedAt: null,
  slaHours: 72,
  risk: { score: 18, level: 'baixo', factors: ['Sem duplicidade', 'Idioma consistente'] },
  reviewType: 'integral',
  reviewReason: 'Primeiros 5 decks do autor',
  assignedTo: 'adm1',
  decision: null,
  publicId: null,
  categoryId: 'vestibular',
  categoryName: 'Vestibular/ENEM',
  difficulty: 'medio',
  cardCount: 2,
  sla: { pct: 42, dueAt: hoursAgo(-42), alert: false, hoursLeft: 42 }
}

const pub3 = { ...pub2, id: 'pub3', deckName: 'Anatomia: ossos do crânio', authorName: 'Carlos T.', plan: 'premium', slaHours: 24, risk: { score: 81, level: 'alto', factors: ['Possível cópia em massa'] }, sla: { pct: 83, dueAt: hoursAgo(-4), alert: true, hoursLeft: 4 } }

const queue = { queue: [pub3, pub2], pipeline: { autoTriage: ['classificador de conteúdo', 'duplicidade'], integralReview: ['risco alto', 'primeiros 5 decks do autor'], sampleReview: 'autores com histórico limpo', sla: { premium: 24, free: '48 a 72' }, alertAtPct: 70 }, categories: ['veracidade', 'material_protegido'] }

const detail = {
  publication: { ...pub2, snapshot: [{ id: 'c1', front: 'Qual organela realiza a síntese de ATP?', back: 'A mitocôndria.' }, { id: 'c2', front: 'Função dos ribossomos?', back: 'Síntese de proteínas.' }] },
  authorHistory: [{ id: 'pub1', deckName: 'Direito Administrativo', status: 'aprovado', decidedAt: hoursAgo(300) }],
  categories: ['veracidade', 'material_protegido']
}

function respond(body, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

const calls = []

function mockFetch() {
  calls.length = 0
  global.fetch = vi.fn(async (url, opts = {}) => {
    const path = String(url)
    const method = opts.method || 'GET'
    calls.push({ path, method, body: opts.body ? JSON.parse(opts.body) : null })
    if (method === 'POST' && path.endsWith('/v1/admin/auth/login')) {
      const body = JSON.parse(opts.body)
      return respond({ token: 'tok_admin', user: { id: 'adm1', name: 'Ana Moderadora', role: body.role, areas: ['Biologia'] }, roles: ['moderador'] })
    }
    if (method === 'GET' && path.endsWith('/v1/admin/moderation/queue')) return respond(queue)
    if (method === 'GET' && path.endsWith('/v1/admin/moderation/pub2')) return respond(detail)
    if (method === 'POST' && path.endsWith('/v1/admin/moderation/pub2/decide')) {
      const body = JSON.parse(opts.body)
      if (body.decision === 'rejeitado' && (!body.reasonCategory || !body.excerpt)) return respond({ code: 'validation', message: 'Rejeição exige motivo categorizado e trecho apontado.' }, 422)
      return respond({ publication: { ...pub2, status: body.decision, decidedAt: new Date(now).toISOString(), decision: { by: 'adm1', byName: 'Ana Moderadora', decision: body.decision, reasonCategory: body.reasonCategory || null, excerpt: body.excerpt || null }, sla: { pct: 100, dueAt: null, alert: false, hoursLeft: 0 } } })
    }
    return respond({ code: 'not_found', message: 'rota não mockada' }, 404)
  })
}

function renderArea(entry = '/admin/login') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/admin/*" element={<AdminArea />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

async function loginAsModerator(user) {
  await user.click(screen.getByRole('radio', { name: /Moderador/ }))
  await user.click(screen.getByRole('button', { name: /Entrar como Moderador/i }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Console de moderação' })).toBeInTheDocument())
}

describe('Back-office', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('login como moderador leva à fila de moderação ordenada por SLA e risco', async () => {
    const user = userEvent.setup()
    renderArea()
    await loginAsModerator(user)
    expect(screen.getByText('Anatomia: ossos do crânio')).toBeInTheDocument()
    expect(screen.getByText('Citologia')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Moderação/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Financeiro/ })).toBeNull()
    expect(screen.getAllByText('Alto').length).toBeGreaterThan(0)
  })

  it('rejeitar sem motivo e trecho mostra erro e não chama a API', async () => {
    const user = userEvent.setup()
    renderArea()
    await loginAsModerator(user)
    await user.click(screen.getAllByRole('button', { name: /Abrir/ })[1])
    await waitFor(() => expect(screen.getByRole('heading', { name: /Snapshot dos cards/ })).toBeInTheDocument())
    await user.click(screen.getByRole('radio', { name: /Rejeitar/ }))
    await user.click(screen.getByRole('button', { name: /Registrar decisão/ }))
    expect(await screen.findByText('Rejeição exige motivo categorizado e trecho apontado.')).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/decide'))).toBe(false)
  })

  it('aprovar confirma e chama a rota de decisão', async () => {
    const user = userEvent.setup()
    renderArea()
    await loginAsModerator(user)
    await user.click(screen.getAllByRole('button', { name: /Abrir/ })[1])
    await waitFor(() => expect(screen.getByRole('heading', { name: /Snapshot dos cards/ })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Registrar decisão/ }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/v1/admin/moderation/pub2/decide') && c.body.decision === 'aprovado')).toBe(true))
    await waitFor(() => expect(screen.getByText(/Decidido em/)).toBeInTheDocument())
  })
})
