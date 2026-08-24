// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TitleBar } from '../TitleBar'

type Ouvinte = (maximizada: boolean) => void

function instalarApi(opcoes: { controlesProprios?: boolean; maximizada?: boolean } = {}) {
  const ouvintes: Ouvinte[] = []
  const api = {
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
