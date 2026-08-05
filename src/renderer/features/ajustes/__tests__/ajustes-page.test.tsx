// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG_DEFAULTS, type Config } from '@shared/ipc/config'
import { ToastProvider } from '../../../components/ui'
import AjustesPage from '../AjustesPage'

function instalarApiMock(configInicial: Config = CONFIG_DEFAULTS) {
  const api = {
    config: {
      get: vi.fn().mockResolvedValue(configInicial),
      set: vi.fn().mockImplementation((c: Config) => Promise.resolve(c)),
      escolherPastaBackup: vi.fn(),
      listarBackups: vi.fn().mockResolvedValue([]),
      restaurarBackup: vi.fn(),
      abrirPastaBackups: vi.fn().mockResolvedValue(null)
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderPagina() {
  return render(
    <ToastProvider>
      <AjustesPage />
    </ToastProvider>
  )
}

describe('AjustesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('carrega e exibe a configuracao atual', async () => {
    instalarApiMock({ ...CONFIG_DEFAULTS, retencaoBackups: 25 })
    renderPagina()

    const retencao = await screen.findByLabelText('Quantidade de backups mantidos')
    expect((retencao as HTMLInputElement).value).toBe('25')
    expect((screen.getByLabelText('Pasta de backups') as HTMLInputElement).value).toContain(
      'Padrão'
    )
  })

  it('salva a configuracao editada e mostra toast de sucesso', async () => {
    const api = instalarApiMock()
    const user = userEvent.setup()
    renderPagina()

    const retencao = await screen.findByLabelText('Quantidade de backups mantidos')
    await user.clear(retencao)
    await user.type(retencao, '30')
    await user.click(screen.getByLabelText(/Fazer backup ao sair/))
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))

    expect(await screen.findByText('Ajustes salvos.')).toBeTruthy()
    expect(api.config.set).toHaveBeenCalledWith(
      expect.objectContaining({ retencaoBackups: 30, backupAoSair: false })
    )
  })

  it('mostra a mensagem original quando o IPC falha', async () => {
    const api = instalarApiMock()
    api.config.set.mockRejectedValue(
      new Error("Error invoking remote method 'config:set': Error: Disco cheio")
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByLabelText('Quantidade de backups mantidos')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))

    expect(await screen.findByText('Disco cheio')).toBeTruthy()
  })

  it('retencao invalida bloqueia o submit com erro de validacao', async () => {
    const api = instalarApiMock()
    const user = userEvent.setup()
    renderPagina()

    const retencao = await screen.findByLabelText('Quantidade de backups mantidos')
    await user.clear(retencao)
    await user.type(retencao, '0')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))

    expect(api.config.set).not.toHaveBeenCalled()
  })

  it('escolher pasta atualiza o campo com o caminho retornado', async () => {
    const api = instalarApiMock()
    api.config.escolherPastaBackup.mockResolvedValue('D:\\MeusBackups')
    const user = userEvent.setup()
    renderPagina()

    await screen.findByLabelText('Quantidade de backups mantidos')
    await user.click(screen.getByRole('button', { name: 'Escolher pasta…' }))

    const pasta = (await screen.findByLabelText('Pasta de backups')) as HTMLInputElement
    expect(pasta.value).toBe('D:\\MeusBackups')
  })
})
