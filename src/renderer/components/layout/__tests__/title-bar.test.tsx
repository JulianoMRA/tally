// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TitleBar } from '../TitleBar'

type AppMock = {
  exportarDados: ReturnType<typeof vi.fn>
  importarDados: ReturnType<typeof vi.fn>
  verificarAtualizacoes: ReturnType<typeof vi.fn>
  sair: ReturnType<typeof vi.fn>
}

function instalarApi(): AppMock {
  const app: AppMock = {
    exportarDados: vi.fn().mockResolvedValue(undefined),
    importarDados: vi.fn().mockResolvedValue(undefined),
    verificarAtualizacoes: vi.fn().mockResolvedValue(undefined),
    sair: vi.fn().mockResolvedValue(undefined)
  }
  vi.stubGlobal('window', Object.assign(window, { api: { app } }))
  return app
}

async function abrirMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Menu do aplicativo' }))
  return user
}

describe('TitleBar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  // As quatro acoes viviam no menu nativo "Arquivo", que deixou de existir com a
  // barra propria. Exportar e Importar dados (JSON do banco inteiro) nao tinham
  // outro lugar no app — perde-las seria apagar funcionalidade.
  it('oferece as quatro ações que vieram do menu Arquivo', async () => {
    instalarApi()
    render(<TitleBar />)
    await abrirMenu()

    const menu = screen.getByRole('menu')
    for (const rotulo of [
      'Exportar dados…',
      'Importar dados…',
      'Verificar atualizações…',
      'Sair'
    ]) {
      expect(menu.textContent).toContain(rotulo)
    }
  })

  it.each([
    ['Exportar dados…', 'exportarDados'],
    ['Importar dados…', 'importarDados'],
    ['Verificar atualizações…', 'verificarAtualizacoes'],
    ['Sair', 'sair']
  ] as const)('aciona %s pelo IPC', async (rotulo, metodo) => {
    const app = instalarApi()
    render(<TitleBar />)
    const user = await abrirMenu()

    await user.click(screen.getByRole('menuitem', { name: rotulo }))

    expect(app[metodo]).toHaveBeenCalledOnce()
  })

  it('não repete a marca: a Sidebar já mostra o nome do app', () => {
    instalarApi()
    render(<TitleBar />)

    expect(screen.queryByText('Tally')).toBeNull()
  })

  it('expõe a barra como região arrastável, e o menu como área clicável', () => {
    instalarApi()
    const { container } = render(<TitleBar />)

    const barra = container.firstElementChild as HTMLElement
    expect(barra.className).toBeTruthy()
    // O gatilho do menu precisa ficar fora da região de arrasto, senão o clique
    // vira gesto de mover a janela e o botão nunca abre.
    expect(barra.querySelector('[data-arrasto="nao"]')).toBeTruthy()
  })
})
