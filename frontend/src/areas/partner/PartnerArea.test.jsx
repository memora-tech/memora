import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PartnerArea } from './PartnerArea.jsx'
import { partnerApi } from '../../lib/api.js'

const overview = {
  partner: {
    id: 'p1',
    name: 'Café Sinapse',
    cnpj: '12.345.678/0001-90',
    category: 'Alimentação',
    verified: true,
    approvalStages: ['Documentação validada', 'Aprovação comercial'],
    contact: 'Renata Prado',
    email: 'renata@cafesinapse.com.br',
    contract: { startedAt: '2026-07-11T12:00:00.000Z', minMonths: 3, positioningTier: 'Destaque na loja', positioningMonthlyBRL: 350, cpaBRL: 1.2, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: false, renewsAt: '2026-10-09T12:00:00.000Z' }
  },
  campaigns: [{ id: 'cp1', partnerId: 'p1', partnerName: 'Café Sinapse', title: '1 café coado', description: 'Um café coado grande.', costNeurons: 30, stock: 120, validityDays: 30, positioning: 'destaque', category: 'Alimentação', terms: '', redemptions: 4, used: 1 }],
  redemptions: [{ id: 'rd1', partnerId: 'p1', code: 'MEM-7K2P-91QX', redeemedAt: '2026-08-20T12:00:00.000Z', validUntil: '2026-09-19T12:00:00.000Z', status: 'emitido', campaignId: 'cp1' }],
  conversion: { period: 'Últimos 30 dias', redemptions: 412, confirmedUse: 268, expired: 61, minCell: 20, cells: [{ label: '18 a 24 anos · SP capital', n: 180, shown: true }, { label: '18 a 24 anos · RJ', n: null, shown: false, suppressed: 'Menos de 20 pessoas' }] },
  positioningTable: [{ tier: 'Sem posicionamento', monthlyBRL: 0, description: 'Por relevância.' }, { tier: 'Destaque na loja', monthlyBRL: 350, description: 'Selo de destaque.' }],
  alerts: [],
  billing: { model: 'CPA (paga só no resgate) + comissão de intermediação', cpaBRL: 1.2, commissionPct: 8, positioningMonthlyBRL: 350 },
  api: { baseUrl: '/v1/partner/redemptions/validate', key: 'pk_live_••••7f2a', docs: 'Dê baixa por API ou por este painel.' }
}

function mockFetch({ validate } = {}) {
  const calls = []
  let validateCalls = 0
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET'
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ method, url, body })
    const respond = (status, payload) => ({ ok: status < 400, status, json: async () => payload })
    if (method === 'POST' && url === '/v1/partner/auth/login') return respond(200, { token: 'tok_p1', user: { id: 'pt1', name: 'Renata Prado', partnerName: 'Café Sinapse' } })
    if (method === 'GET' && url === '/v1/partner/overview') return respond(200, overview)
    if (method === 'POST' && url === '/v1/partner/redemptions/validate') {
      validateCalls += 1
      if (validate) return validate(body, validateCalls)
      return respond(200, { ok: true, code: body.code, usedAt: '2026-09-09T10:00:00.000Z', message: 'Baixa registrada.' })
    }
    if (method === 'POST' && url === '/v1/partner/contract/accept') return respond(200, { contract: { ...overview.partner.contract, acceptedDigitally: true, acceptedAt: '2026-09-09T10:00:00.000Z' } })
    return respond(404, { code: 'not_found' })
  })
  return calls
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/parceiro/*" element={<PartnerArea />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  partnerApi.setToken(null)
})

describe('Painel do Parceiro', () => {
  it('login com CNPJ leva ao painel com contrato e etapas de aprovação', async () => {
    mockFetch()
    renderAt('/parceiro/login')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('CNPJ'), '12345678000190')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getAllByText('Café Sinapse').length).toBeGreaterThan(0))
    expect(partnerApi.getToken()).toBe('tok_p1')
    expect(screen.getByText('Contrato')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceitar contrato digitalmente' })).toBeInTheDocument()
    expect(screen.getByText(/Aprovação comercial/)).toBeInTheDocument()
  })

  it('dar baixa com sucesso registra o código uma vez', async () => {
    const calls = mockFetch()
    partnerApi.setToken('tok_p1')
    renderAt('/parceiro/painel/validar')
    await waitFor(() => expect(screen.getByLabelText('Código do cupom')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Código do cupom'), 'mem-7k2p-91qx')
    await user.click(screen.getByRole('button', { name: 'Confirmar baixa' }))
    await waitFor(() => expect(screen.getByText('Baixa registrada')).toBeInTheDocument())
    expect(calls.some((c) => c.url === '/v1/partner/redemptions/validate' && c.body.code === 'MEM-7K2P-91QX')).toBe(true)
  })

  it('código já utilizado mostra o bloqueio 409', async () => {
    mockFetch({ validate: () => ({ ok: false, status: 409, json: async () => ({ code: 'already_used', message: 'Este código já foi utilizado.', usedAt: '2026-09-08T10:00:00.000Z' }) }) })
    partnerApi.setToken('tok_p1')
    renderAt('/parceiro/painel/validar')
    await waitFor(() => expect(screen.getByLabelText('Código do cupom')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Código do cupom'), 'MEM-8HNF-2C4V')
    await user.click(screen.getByRole('button', { name: 'Confirmar baixa' }))
    await waitFor(() => expect(screen.getByText('Este código já foi utilizado')).toBeInTheDocument())
  })

  it('relatório suprime células com menos de 20 pessoas', async () => {
    mockFetch()
    partnerApi.setToken('tok_p1')
    renderAt('/parceiro/painel/relatorio')
    await waitFor(() => expect(screen.getByText('Relatório de conversão')).toBeInTheDocument())
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText(/Suprimido/)).toBeInTheDocument()
  })
})
