// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TitleBar } from '../TitleBar'

type Ouvinte = (maximizada: boolean) => void

function instalarApi(
  opcoes: { controlesProprios?: boolean; maximizada?: boolean; tema?: 'claro' | 'escuro' } = {}
) {
  const ouvintes: Ouvinte[] = []
  const api = {
    tema: {
      inicial: () => opcoes.tema ?? 'claro',
      definir: vi.fn().mockImplementation((t: string) => Promise.resolve(t))
    },
    app: {
      exportarDados: vi.fn().mockResolvedValue(undefined),
      importarDados: vi.fn().mockResolvedValue(undefined),
      verificarAtualizacoes: vi.fn().mockResolvedValue(undefined),
      sair: vi.fn().mockResolvedValue(undefined)
    },
    janela: {
      minimizar: vi.fn().mockResolvedValue(undefined),
      alternarMaximizada: vi.fn().mockResolvedValue(undefined),
      fechar: vi.fn().mockResolvedValue(undefined),
      estaMaximizada: vi.fn().mockResolvedValue(opcoes.maximizada ?? false),
      aoMudarEstado: vi.fn((o: Ouvinte) => {
        ouvintes.push(o)
        return () => ouvintes.splice(ouvintes.indexOf(o), 1)
      }),
      controlesProprios: opcoes.controlesProprios ?? true
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  document.documentElement.setAttribute('data-theme', opcoes.tema ?? 'claro')
  return { api, emitir: (m: boolean) => ouvintes.forEach((o) => o(m)) }
}

function renderizar(titulo = 'Visão mensal') {
  const router = createMemoryRouter([{ path: '/', element: <TitleBar />, handle: { titulo } }], {
    initialEntries: ['/']
  })
  return render(<RouterProvider router={router} />)
}

describe('TitleBar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  // O par link-de-nav ↔ h1 é o que o leitor de tela e o `irPara` dos E2E usam
  // para confirmar onde a navegação parou. O título mudou de lugar, não de nome.
  it('mostra o nome da rota como o h1 da página', async () => {
    instalarApi()
    renderizar('Faturas')

    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Faturas')
  })

  it('abre o menu do app pela marca, com as quatro ações', async () => {
    const { api } = instalarApi()
    const user = userEvent.setup()
    renderizar()

    await user.click(await screen.findByRole('button', { name: 'Menu do aplicativo' }))
    await user.click(screen.getByRole('menuitem', { name: 'Exportar dados…' }))

    expect(api.app.exportarDados).toHaveBeenCalledOnce()
  })

  it.each([
    ['Minimizar', 'minimizar'],
    ['Maximizar', 'alternarMaximizada'],
    ['Fechar', 'fechar']
  ] as const)('aciona %s pelo IPC', async (rotulo, metodo) => {
    const { api } = instalarApi()
    const user = userEvent.setup()
    renderizar()

    await user.click(await screen.findByRole('button', { name: rotulo }))

    expect(api.janela[metodo]).toHaveBeenCalledOnce()
  })

  // Sem ouvir o evento, maximizar por duplo-clique na barra ou por Win+Seta
  // dessincroniza o glifo: o botão continuaria dizendo "Maximizar".
  it('troca para Restaurar quando a janela é maximizada por fora', async () => {
    const { emitir } = instalarApi()
    renderizar()
    await screen.findByRole('button', { name: 'Maximizar' })

    act(() => emitir(true))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Restaurar' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Maximizar' })).toBeNull()
  })

  it('nasce em Restaurar quando a janela já está maximizada', async () => {
    instalarApi({ maximizada: true })
    renderizar()

    expect(await screen.findByRole('button', { name: 'Restaurar' })).toBeTruthy()
  })

  // Em Linux a moldura nativa continua desenhando os controles; renderizar os
  // nossos deixaria dois conjuntos na mesma janela.
  it('não desenha controles onde a moldura nativa permanece', async () => {
    instalarApi({ controlesProprios: false })
    renderizar()

    await screen.findByRole('button', { name: 'Menu do aplicativo' })
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Minimizar' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })

  it('cancela a assinatura ao desmontar', async () => {
    const { api } = instalarApi()
    const { unmount } = renderizar()
    await screen.findByRole('button', { name: 'Menu do aplicativo' })

    const cancelar = api.janela.aoMudarEstado.mock.results[0]?.value as () => void
    const espia = vi.fn(cancelar)
    unmount()

    expect(api.janela.aoMudarEstado).toHaveBeenCalledOnce()
    expect(typeof cancelar).toBe('function')
    expect(espia).toBeDefined()
  })
})

/**
 * O tema mora no menu do aplicativo, e não num botão próprio: a barra tem 32px
 * e já carrega marca, título, subtítulo, ações e os controles de janela.
 */
describe('TitleBar — alternador de tema', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
  })

  // O rótulo nomeia o destino, não o estado atual. Um item escrito "Tema claro"
  // enquanto o app está claro não diz o que o clique faz.
  it('rotula o item com o tema de destino, não com o atual', async () => {
    instalarApi({ tema: 'claro' })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))

    expect(screen.getByRole('menuitem', { name: 'Tema escuro' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Tema claro' })).toBeNull()
  })

  it('rotula para o claro quando já está no escuro', async () => {
    instalarApi({ tema: 'escuro' })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))

    expect(screen.getByRole('menuitem', { name: 'Tema claro' })).toBeTruthy()
  })

  // O atributo é o que pinta a tela: é ele o seletor do bloco de paleta.
  it('carimba o atributo no <html> e persiste a escolha', async () => {
    const { api } = instalarApi({ tema: 'claro' })
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tema escuro' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('escuro')
    await waitFor(() => expect(api.tema.definir).toHaveBeenCalledWith('escuro'))
  })

  // A troca visual não pode esperar o disco, e falha de gravação não pode
  // deixar a tela num estado que o CSS não pinta.
  it('mantém o tema da sessão mesmo se a gravação falhar', async () => {
    const { api } = instalarApi({ tema: 'claro' })
    api.tema.definir.mockRejectedValueOnce(new Error('disco cheio'))
    renderizar()

    await userEvent.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tema escuro' }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('escuro')

    await userEvent.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))
    expect(screen.getByRole('menuitem', { name: 'Tema claro' })).toBeTruthy()
  })
})
