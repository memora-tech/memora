import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from '../app/App.jsx'
import { startLiveServer } from './liveServer.js'

let live

beforeEach(async () => {
  live = await startLiveServer()
  await live.login()
})

afterEach(async () => {
  await live.close()
})

describe('sessão de estudo em StrictMode', () => {
  it('abre a sessão e permanece nela quando os efeitos rodam duas vezes', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/app']}>
          <AppProviders>
            <AppRoutes />
          </AppProviders>
        </MemoryRouter>
      </StrictMode>
    )
    const start = await screen.findByTestId('btn-comecar')
    await userEvent.click(start)
    expect(await screen.findByText(/Card 1 de/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: ' ' })
    expect(await screen.findByRole('button', { name: /^Lembrei/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await screen.findByText(/Card 2 de/)).toBeInTheDocument()
  })

  it('sair pela confirmação volta para a sessão do dia', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/app']}>
          <AppProviders>
            <AppRoutes />
          </AppProviders>
        </MemoryRouter>
      </StrictMode>
    )
    await userEvent.click(await screen.findByTestId('btn-comecar'))
    await screen.findByText(/Card 1 de/)
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sair' }))
    expect(await screen.findByTestId('btn-comecar')).toBeInTheDocument()
  })
})
