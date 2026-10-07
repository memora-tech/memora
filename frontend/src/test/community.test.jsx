import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('comunidade com vários tipos de conteúdo', () => {
  it('abas por tipo funcionam por setas e filtram o conteúdo', async () => {
    renderAt('/app/comunidade')
    const tablist = await screen.findByRole('tablist', { name: 'Tipo de conteúdo' })
    const all = within(tablist).getByRole('tab', { name: /Tudo/ })
    expect(all).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { name: 'Linha do tempo' }, { timeout: 4000 })).toBeInTheDocument()
    all.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    const mapas = within(tablist).getByRole('tab', { name: /Mapas mentais/ })
    expect(mapas).toHaveAttribute('aria-selected', 'true')
    expect(mapas).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', mapas.id)
    expect(await screen.findByText('Mapa mental: sistema cardiovascular')).toBeInTheDocument()
    expect(screen.getByText('2 publicações')).toBeInTheDocument()
  })

  it('mapa mental abre e fecha ramos pelo botão com aria-expanded', async () => {
    renderAt('/app/comunidade/conteudo/m2')
    expect(await screen.findByRole('heading', { level: 2, name: 'Sistema cardiovascular' }, { timeout: 4000 })).toBeInTheDocument()
    const heart = screen.getByRole('button', { name: /^Coração/ })
    expect(heart).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Ciclo cardíaco')).toBeVisible()
    await userEvent.click(heart)
    expect(heart).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(heart.getAttribute('aria-controls'))).not.toBeVisible()
  })

  it('resumo é renderizado com títulos e listas, sem HTML cru', async () => {
    renderAt('/app/comunidade/conteudo/m1')
    expect(await screen.findByRole('heading', { name: '1. Glicólise' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('aceptor final').tagName).toBe('STRONG')
  })

  it('Minhas publicações reúne blog e decks, sem o que ainda está pendente no MCP', async () => {
    renderAt('/app/comunidade?tipo=mine')
    const title = await screen.findByText('Como montei meu cronograma para a OAB', {}, { timeout: 4000 })
    expect(screen.getByText('Direito Constitucional')).toBeInTheDocument()
    expect(screen.queryByText('Como funciona a repetição espaçada')).not.toBeInTheDocument()
    const row = title.closest('li')
    await userEvent.click(within(row).getByRole('button', { name: 'Compartilhar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartilhar' })
    expect(within(dialog).getByRole('radio', { name: /Toda a comunidade/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar para moderação' }))
    await waitFor(() => expect(live.store.state.materials.find((m) => m.id === 'm8').status).toBe('em_triagem'))
  })

  it('aba Blog mostra a lista editorial com botão de escrever', async () => {
    renderAt('/app/comunidade?tipo=noticia')
    expect(await screen.findByRole('heading', { name: 'Blog da comunidade' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ENEM 2026: entenda como a nota da TRI é calculada' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Escrever post/ }).length).toBeGreaterThan(0)
  })

  it('conteúdo publicado abre os comentários', async () => {
    renderAt('/app/comunidade/conteudo/m3')
    const button = await screen.findByRole('button', { name: '2 comentários' }, { timeout: 4000 })
    await userEvent.click(button)
    expect(await screen.findByText(/Não sabia que errar questão fácil/)).toBeInTheDocument()
  })
})

describe('meu blog', () => {
  it('escreve um post e compartilha só com seguidores', async () => {
    live.store.state.consents.u1.contentPolicyAcceptedVersion = live.store.state.admin.policy.version
    renderAt('/app/perfil/blog/novo')
    await userEvent.type(await screen.findByLabelText('Título', {}, { timeout: 4000 }), 'Meu primeiro post')
    await userEvent.type(screen.getByLabelText(/Linha fina/), 'Um resumo curto do post.')
    await userEvent.type(screen.getByRole('textbox', { name: 'Texto' }), 'Este é o texto do meu primeiro post no blog do Memora, com mais de quarenta caracteres.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e compartilhar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartilhar' })
    await userEvent.click(within(dialog).getByRole('radio', { name: /Só quem me segue/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Compartilhar com seguidores' }))
    await waitFor(() => {
      const post = live.store.state.materials.find((m) => m.title === 'Meu primeiro post')
      expect(post).toMatchObject({ status: 'aprovado', audience: 'seguidores', aiGenerated: false })
    })
  })

  it('perfil mostra a seção Meu blog com o rascunho', async () => {
    renderAt('/app/perfil')
    expect(await screen.findByRole('heading', { name: /Meu blog/ }, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Como montei meu cronograma para a OAB' }, { timeout: 4000 })).toBeInTheDocument()
  })
})

describe('estrutura do app', () => {
  it('a comunidade não mostra nada de MCP', async () => {
    renderAt('/app/comunidade')
    expect(await screen.findByRole('heading', { name: 'Linha do tempo' }, { timeout: 4000 })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByText(/MCP/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Conectar IA/ })).not.toBeInTheDocument()
  })

  it('o card do usuário abre o menu da conta com Conexões, e Perfil não fica no menu lateral', async () => {
    renderAt('/app')
    const [nav] = await screen.findAllByRole('navigation', { name: 'Navegação principal' }, { timeout: 4000 })
    expect(within(nav).queryByRole('link', { name: /^Perfil$/ })).not.toBeInTheDocument()
    const userButton = within(nav).getByRole('button', { name: /Manoel/ })
    expect(userButton).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(userButton)
    const menu = await screen.findByRole('menu', { name: 'Menu da conta' })
    expect(within(menu).getByRole('menuitem', { name: /Perfil/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: /Conexões/ })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(userButton).toHaveFocus()
  })

  it('a aba Estudar mostra os decks programados na aba Decks', async () => {
    renderAt('/app')
    const section = await screen.findByRole('region', { name: 'Decks programados' }, { timeout: 4000 })
    expect(within(section).getByRole('link', { name: 'Citologia' })).toBeInTheDocument()
    expect(within(section).queryByRole('link', { name: 'Farmacologia' })).not.toBeInTheDocument()
  })

  it('programar um deck na aba Decks muda o plano do dia', async () => {
    renderAt('/app/decks')
    const toggles = await screen.findAllByRole('button', { name: 'Programar estudo' }, { timeout: 4000 })
    expect(toggles).toHaveLength(2)
    await userEvent.click(toggles[0])
    await waitFor(() => expect(live.store.state.decks.filter((d) => d.scheduled).length).toBe(5))
  })

  it('a área da Nôa mostra sugestões e permite desfazer decisões', async () => {
    renderAt('/app/noa')
    expect(await screen.findByText('Marcar Direito Constitucional como difícil?', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Direito Constitucional')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/app/decks/d1?modo=fracos')
    const suggestionsTab = screen.getByRole('tab', { name: /Sugestões/ })
    suggestionsTab.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')
    const undo = screen.getAllByRole('button', { name: 'Desfazer' })[0]
    await userEvent.click(undo)
    await waitFor(() => expect(live.store.state.noa.decisions.find((d) => d.id === 'dec1').reverted).toBe(true))
  })
})

describe('deck e objetivos', () => {
  it('deck mostra pergunta e resposta rotuladas, publicação visível e modo pontos fracos via link', async () => {
    renderAt('/app/decks/d1?modo=fracos')
    expect(await screen.findByRole('heading', { name: 'Direito Constitucional', level: 1 }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Você está em' })).toHaveTextContent('Meus decks')
    expect(screen.getAllByRole('button', { name: 'Publicar na comunidade' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('radio', { name: /Pontos fracos/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Começar · 2 cards' })).toBeInTheDocument()
    expect(screen.getAllByText('Pergunta').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Resposta').length).toBeGreaterThan(0)
  })

  it('objetivos destacam a próxima prova com o alvo e os dias restantes', async () => {
    renderAt('/app/perfil/objetivos')
    const next = await screen.findByRole('region', { name: /ENEM/ }, { timeout: 4000 })
    expect(within(next).getByText('23')).toBeInTheDocument()
    expect(within(next).getByText(/Faltam 23 dias/)).toBeInTheDocument()
  })
})

describe('recebidos via MCP', () => {
  it('pendente aparece em Recebidos, com contador no menu, e aprovar para o meu blog tira da fila', async () => {
    renderAt('/app/recebidos')
    expect(await screen.findByRole('heading', { name: 'Recebidos via MCP', level: 1 }, { timeout: 4000 })).toBeInTheDocument()
    const [nav] = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    expect(await within(nav).findByRole('link', { name: /Recebidos \(MCP\).*1/ }, { timeout: 4000 })).toBeInTheDocument()
    const card = (await screen.findByRole('heading', { name: 'Como funciona a repetição espaçada' })).closest('article')
    await userEvent.click(within(card).getByRole('button', { name: 'Aprovar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aprovar solicitação' })
    await userEvent.click(within(dialog).getByRole('radio', { name: /Só no meu blog/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar e guardar no meu blog' }))
    await waitFor(() => expect(live.store.state.materials.find((m) => m.id === 'm7')).toMatchObject({ mcpReview: 'aprovado', status: 'privado' }))
    expect(await screen.findByText('Nenhuma solicitação esperando')).toBeInTheDocument()
  })

  it('recusar exclui o conteúdo enviado pela IA', async () => {
    renderAt('/app/recebidos')
    const card = (await screen.findByRole('heading', { name: 'Como funciona a repetição espaçada' }, { timeout: 4000 })).closest('article')
    await userEvent.click(within(card).getByRole('button', { name: 'Recusar' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Recusar' }))
    await waitFor(() => expect(live.store.state.materials.find((m) => m.id === 'm7')).toMatchObject({ mcpReview: 'recusado' }))
    expect(live.store.state.materials.find((m) => m.id === 'm7').deletedAt).toBeTruthy()
  })
})

describe('conexões MCP no perfil', () => {
  it('gera token uma vez, mostra a configuração e lista ferramentas', async () => {
    renderAt('/app/comunidade/conectar')
    expect(await screen.findByRole('heading', { name: 'Conexões', level: 1 }, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByText('salvar_flashcards')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Nome da conexão/), 'ChatGPT')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar token' }))
    expect(await screen.findByRole('heading', { name: 'Token da conexão "ChatGPT"' })).toBeInTheDocument()
    expect(screen.getByText(/claude mcp add --transport http memora/)).toBeInTheDocument()
    const saved = live.store.state.mcp.connections.find((c) => c.name === 'ChatGPT')
    expect(saved.tokenHash).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Já copiei' }))
    expect(screen.queryByText(/claude mcp add/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Revogar ChatGPT' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revogar' }))
    await waitFor(() => expect(live.store.state.mcp.connections.find((c) => c.name === 'ChatGPT').revokedAt).toBeTruthy())
  })
})
