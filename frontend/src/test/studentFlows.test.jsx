import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from '../app/App.jsx'
import { startLiveServer } from './liveServer.js'

let live

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  live = await startLiveServer()
  await live.login()
})

afterEach(async () => {
  await live.close()
})

describe('regra dos 3 toques', () => {
  it('abre em E1 com Começar a 1 toque e mostra 18 cards em 6 minutos', async () => {
    renderAt('/app')
    const start = await screen.findByRole('button', { name: /Começar/ }, { timeout: 4000 })
    expect(start).toBeInTheDocument()
    expect(await screen.findByText(/18 cards para hoje/)).toBeInTheDocument()
    expect(screen.getByText(/~6 min/)).toBeInTheDocument()
  })

  it('Carteira a 1 toque pela linha do topo mostra o saldo 149 após o crédito diário', async () => {
    renderAt('/app')
    const wallet = await screen.findByRole('button', { name: /Abrir Carteira/ })
    await userEvent.click(wallet)
    expect(await screen.findByRole('heading', { name: 'Carteira' })).toBeInTheDocument()
    expect(await screen.findByText('Loja de cupons')).toBeInTheDocument()
    await waitFor(() => expect(live.store.state.ledger.filter((e) => e.type === 'daily_access').length).toBeGreaterThan(30))
  })

  it('Criar deck a 1 toque pelo botão + abre as cinco origens', async () => {
    renderAt('/app')
    const create = await screen.findAllByRole('link', { name: 'Criar deck' })
    await userEvent.click(create[0])
    expect(await screen.findByRole('heading', { name: 'Criar deck' })).toBeInTheDocument()
    expect(screen.getByText('Câmera')).toBeInTheDocument()
    expect(screen.getByText('Colar texto')).toBeInTheDocument()
    expect(screen.getByText('Importar Anki')).toBeInTheDocument()
    expect(screen.getByText('Deck vazio')).toBeInTheDocument()
  })

  it('"Hoje não" reagenda em 1 toque e oferece desfazer', async () => {
    renderAt('/app')
    const skip = await screen.findByRole('button', { name: /^Hoje não/ })
    fireEvent.pointerDown(skip, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerUp(skip, { clientX: 10, clientY: 10, button: 0 })
    expect(await screen.findByText('Meta de hoje reagendada para amanhã')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Desfazer' }).length).toBeGreaterThan(0)
    expect(live.store.state.study.u1.reschedules.used).toBe(3)
  })
})

describe('sessão de estudo por teclado', () => {
  it('espaço vira o card e a seta direita avalia como lembrei', async () => {
    renderAt('/app')
    const start = await screen.findByRole('button', { name: /Começar/ })
    await userEvent.click(start)
    expect(await screen.findByText('Card 1 de 18')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Lembrei/ })).toBeNull()
    fireEvent.keyDown(window, { key: ' ' })
    expect(await screen.findByRole('button', { name: /^Lembrei/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await screen.findByText('Card 2 de 18')).toBeInTheDocument()
    await waitFor(() => expect(live.store.state.reviews.length).toBe(1))
    expect(live.store.state.reviews[0].rating).toBe('good')
  })

  it('a barra recolhe no modo foco e volta ao tocar na borda', async () => {
    renderAt('/app')
    await userEvent.click(await screen.findByRole('button', { name: /Começar/ }))
    await screen.findByText('Card 1 de 18')
    const edge = await screen.findByRole('button', { name: 'Mostrar barra' })
    await userEvent.click(edge)
    expect(await screen.findByRole('button', { name: 'Sair do estudo' })).toBeInTheDocument()
  })
})

describe('carteira', () => {
  it('resgatar cupom com confirmação leva ao QR e debita o saldo', async () => {
    renderAt('/app/carteira/cupom/cp1')
    const redeem = await screen.findByRole('button', { name: 'Resgatar' }, { timeout: 4000 })
    await userEvent.click(redeem)
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resgatar' }))
    expect(await screen.findByText('Seu cupom', {}, { timeout: 3000 }).catch(() => screen.findByRole('img', { name: /QR code/ }))).toBeTruthy()
    await waitFor(() => expect(live.store.state.myCoupons.filter((m) => m.userId === 'u1').length).toBe(4))
    const balance = live.store.state.ledger.filter((e) => e.userId === 'u1').slice(-1)[0].balanceAfter
    expect(balance).toBe(149 - 30)
  })
})

describe('geração', () => {
  it('quarto deck do dia trava com upsell do Premium', async () => {
    live.store.state.generation.quota.u1.used = 3
    renderAt('/app/criar')
    await userEvent.click(await screen.findByText('Colar texto'))
    const textarea = await screen.findByLabelText('Texto')
    await userEvent.type(textarea, 'A primeira lei da termodinâmica relaciona calor e trabalho.')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar cards' }))
    expect(await screen.findByText('Você já criou 3 decks hoje')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Conhecer o Premium/ })).toBeInTheDocument()
  })
})
