// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG_DEFAULTS, type Config } from '@shared/ipc/config'
import { ToastProvider } from '../../../components/ui'
import AjustesPage from '../AjustesPage'

/**
 * `config.get` do mock resolve com ATRASO, de propósito.
 *
 * O `useForm` desta tela recebe `defaultValues` assíncrono: os inputs nascem
 * vazios e só são preenchidos quando o `get` resolve. Com um mock que resolve
 * no microtask seguinte, a corrida quase nunca aparece — os testes passavam por
 * sorte de escalonamento, e só ficavam vermelhos sob carga real.
 *
 * Com o atraso, a ordem passa a ser exercitada em toda execução: quem interage
 * com um campo sem esperar o VALOR chegar digita algo que o preenchimento
 * assíncrono vai sobrescrever, e o teste acusa. É o mesmo princípio de esperar
 * o marcador em vez de dormir um número — só que aqui o atraso está do lado do
 * dublê, para tornar a corrida determinística em vez de rara.
 */
const ATRASO_CARGA_MS = 20

function instalarApiMock(configInicial: Config = CONFIG_DEFAULTS) {
  const api = {
    config: {
      get: vi
        .fn()
        .mockImplementation(
          () => new Promise<Config>((r) => setTimeout(() => r(configInicial), ATRASO_CARGA_MS))
        ),
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

/**
 * Espera o campo existir **e estar preenchido**.
 *
 * `findByLabelText` sozinho espera só o ELEMENTO, que existe desde o primeiro
 * render — interagir aí digita num campo que o preenchimento assíncrono ainda
 * vai sobrescrever. Todo teste que mexe num campo desta tela passa por aqui.
 */
async function campoCarregado(rotulo: string, valorEsperado: string): Promise<HTMLInputElement> {
  const campo = (await screen.findByLabelText(rotulo)) as HTMLInputElement
  await waitFor(() => expect(campo.value).toBe(valorEsperado))
  return campo
}

const RETENCAO = 'Quantidade de backups mantidos'

describe('AjustesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('carrega e exibe a configuracao atual', async () => {
    instalarApiMock({ ...CONFIG_DEFAULTS, retencaoBackups: 25 })
    renderPagina()

    await campoCarregado(RETENCAO, '25')
    expect((screen.getByLabelText('Pasta de backups') as HTMLInputElement).value).toContain(
      'Padrão'
    )
  })

  it('salva a configuracao editada e mostra toast de sucesso', async () => {
    const api = instalarApiMock()
    const user = userEvent.setup()
    renderPagina()

    const retencao = await campoCarregado(RETENCAO, '10')
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

    await campoCarregado(RETENCAO, '10')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))

    expect(await screen.findByText('Disco cheio')).toBeTruthy()
  })

  it('retencao invalida bloqueia o submit com erro de validacao', async () => {
    const api = instalarApiMock()
    const user = userEvent.setup()
    renderPagina()

    const retencao = await campoCarregado(RETENCAO, '10')
    await user.clear(retencao)
    await user.type(retencao, '0')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))

    expect(api.config.set).not.toHaveBeenCalled()
  })

  // A tela rola e o botão de salvar confirma TODAS as seções: sem sinal de
  // pendência, quem mexia em "Avisos de fatura" não tinha como saber que a
  // mudança ainda não estava gravada.
  it('nao avisa pendencia enquanto nada foi editado', async () => {
    instalarApiMock()
    renderPagina()

    // Esperar o VALOR, e não só o campo, é o que dá sentido à asserção: com o
    // formulário ainda vazio "não há alterações" seria verdade por vacuidade.
    await campoCarregado(RETENCAO, '10')

    expect(screen.queryByText('Alterações não salvas')).toBeNull()
  })

  it('avisa que ha alteracoes nao salvas ao editar, e o aviso some ao salvar', async () => {
    instalarApiMock()
    const user = userEvent.setup()
    renderPagina()

    const retencao = await campoCarregado(RETENCAO, '10')
    await user.clear(retencao)
    await user.type(retencao, '30')

    expect(await screen.findByText('Alterações não salvas')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    await screen.findByText('Ajustes salvos.')

    expect(screen.queryByText('Alterações não salvas')).toBeNull()
  })

  it('escolher pasta atualiza o campo com o caminho retornado', async () => {
    const api = instalarApiMock()
    api.config.escolherPastaBackup.mockResolvedValue('D:\\MeusBackups')
    const user = userEvent.setup()
    renderPagina()

    // Sem esperar a carga, o `reset` dos defaultValues chegaria DEPOIS do
    // clique e devolveria a pasta padrão por cima do caminho escolhido.
    await campoCarregado(RETENCAO, '10')
    await user.click(screen.getByRole('button', { name: 'Escolher pasta…' }))

    const pasta = (await screen.findByLabelText('Pasta de backups')) as HTMLInputElement
    expect(pasta.value).toBe('D:\\MeusBackups')
  })
})
