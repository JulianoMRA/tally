// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SimulacaoDoMes } from '@domain/entities/simulacao'
import { SIMULACAO_VAZIA } from '@shared/ipc/simulacao'
import { ToastProvider } from '../../../components/ui'
import SimulacaoPage from '../SimulacaoPage'

const SALDO_DO_MES_CENTAVOS = 20000

function detalheDoMes(saldoProjetadoCentavos = SALDO_DO_MES_CENTAVOS) {
  return {
    mesReferencia: '2026-09',
    faturas: [],
    gastosForaCartao: [],
    recebimentos: [],
    totais: {
      totalSaidasCentavos: 0,
      totalEntradasRecebidasCentavos: saldoProjetadoCentavos,
      totalEntradasProjetadasCentavos: saldoProjetadoCentavos,
      saldoRealizadoCentavos: saldoProjetadoCentavos,
      saldoProjetadoCentavos
    }
  }
}

/**
 * O mock carrega também os canais de escrita de dado real. Eles existem aqui
 * para poderem ser afirmados como NUNCA chamados: é a contrapartida unitária da
 * promessa da tela — simular não cria despesa, renda nem recebimento.
 */
function instalarApiMock(simulacaoInicial: SimulacaoDoMes = SIMULACAO_VAZIA) {
  const api = {
    simulacao: {
      obter: vi.fn().mockResolvedValue(simulacaoInicial),
      salvar: vi.fn().mockImplementation(({ simulacao }) => Promise.resolve(simulacao))
    },
    visaoMensal: {
      detalhar: vi.fn().mockResolvedValue(detalheDoMes())
    },
    despesa: {
      criarUnicaForaCartao: vi.fn(),
      criarUnicaCredito: vi.fn(),
      excluir: vi.fn()
    },
    recebimento: {
      criarAvulso: vi.fn(),
      marcarRecebido: vi.fn()
    },
    renda: {
      criarRecorrente: vi.fn()
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderPagina() {
  return render(
    <ToastProvider>
      <SimulacaoPage />
    </ToastProvider>
  )
}

function saldoSimulado(): string {
  return document.querySelector('[data-saldo-simulado]')?.textContent ?? ''
}

async function adicionarHipotese(
  usuario: ReturnType<typeof userEvent.setup>,
  descricao: string,
  valor: string,
  opcoes: { tipo?: 'Sai' | 'Entra'; vezes?: string } = {}
) {
  await usuario.type(screen.getByLabelText('Descrição*'), descricao)
  await usuario.type(screen.getByLabelText('Valor*'), valor)
  if (opcoes.tipo) {
    await usuario.selectOptions(screen.getByLabelText('Tipo'), opcoes.tipo)
  }
  if (opcoes.vezes) {
    await usuario.clear(screen.getByLabelText('Vezes no mês'))
    await usuario.type(screen.getByLabelText('Vezes no mês'), opcoes.vezes)
  }
  await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))
}

describe('SimulacaoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('parte do saldo do mês quando a base é o saldo', async () => {
    instalarApiMock()
    renderPagina()

    await screen.findByRole('heading', { name: 'Ponto de partida' })

    // Sem hipótese nenhuma, o simulado é a própria base.
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*200,00/))
  })

  it('uma saída derruba o saldo simulado ao vivo', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Fim de semana', '50,00')

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*150,00/))
  })

  it('uma entrada levanta o saldo simulado', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Freela', '80,00', { tipo: 'Entra' })

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*280,00/))
  })

  it('repetições multiplicam o efeito da hipótese', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Fim de semana', '25,00', { vezes: '4' })

    // 200 - (25 x 4) = 100
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*100,00/))
  })

  it('saldo simulado fica negativo quando as hipóteses passam da base', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Notebook', '500,00')

    await waitFor(() => expect(saldoSimulado()).toMatch(/-R\$\s*300,00/))
  })

  it('desligar a hipótese tira do total sem tirar da lista', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')
    await adicionarHipotese(usuario, 'Fim de semana', '50,00')
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*150,00/))

    await usuario.click(screen.getByLabelText('Incluir Fim de semana na conta'))

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*200,00/))
    expect(screen.getByLabelText('Descrição da hipótese')).toBeTruthy()
  })

  it('remover a hipótese tira a linha da lista', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')
    await adicionarHipotese(usuario, 'Fim de semana', '50,00')
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*150,00/))

    await usuario.click(screen.getByRole('button', { name: 'Remover Fim de semana' }))

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*200,00/))
    expect(screen.queryByLabelText('Descrição da hipótese')).toBeNull()
  })

  it('editar o valor da linha digito a digito nao reformata o campo no meio', async () => {
    // Regressao: sincronizar o texto a partir da prop a cada tecla fazia '125'
    // virar '1,00' na segunda tecla, porque o '1' ja tinha virado 100 centavos.
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')
    await adicionarHipotese(usuario, 'Fim de semana', '50,00')

    const campo = screen.getByLabelText('Valor de Fim de semana')
    await usuario.clear(campo)
    await usuario.type(campo, '125,00')

    expect((campo as HTMLInputElement).value).toBe('125,00')
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*75,00/))
  })

  it('base manual usa o valor digitado no lugar do saldo do mês', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByRole('heading', { name: 'Ponto de partida' })

    await usuario.click(screen.getByRole('radio', { name: 'Valor que eu digito' }))
    const campo = await screen.findByLabelText('Tenho na conta')
    await usuario.clear(campo)
    await usuario.type(campo, '1000,00')

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*1\.000,00/))
  })

  it('explica que o valor da base é digitado porque o app não sabe o saldo bancário', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByRole('heading', { name: 'Ponto de partida' })

    await usuario.click(screen.getByRole('radio', { name: 'Valor que eu digito' }))

    expect(screen.getByText(/não sabe quanto há na sua conta hoje/)).toBeTruthy()
  })

  it('grava a simulação depois da edição', async () => {
    const usuario = userEvent.setup()
    const api = instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Fim de semana', '50,00')

    await waitFor(() => expect(api.simulacao.salvar).toHaveBeenCalled(), { timeout: 3000 })
    const { mesReferencia, simulacao } = api.simulacao.salvar.mock.calls.at(-1)![0]
    expect(mesReferencia).toMatch(/^\d{4}-\d{2}$/)
    expect(simulacao.itens).toHaveLength(1)
    expect(simulacao.itens[0]).toMatchObject({
      descricao: 'Fim de semana',
      valorCentavos: 5000,
      tipo: 'saida',
      ativo: true
    })
  })

  it('carrega a simulação já gravada do mês', async () => {
    instalarApiMock({
      base: { modo: 'manual', valorManualCentavos: 50000 },
      itens: [
        {
          id: 'a',
          descricao: 'Aluguel do estúdio',
          valorCentavos: 30000,
          repeticoes: 1,
          tipo: 'saida',
          ativo: true
        }
      ]
    })
    renderPagina()

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*200,00/))
    expect((screen.getByLabelText('Descrição da hipótese') as HTMLInputElement).value).toBe(
      'Aluguel do estúdio'
    )
  })

  it('nao cria despesa, renda nem recebimento ao simular', async () => {
    const usuario = userEvent.setup()
    const api = instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    await adicionarHipotese(usuario, 'Fim de semana', '50,00')
    await adicionarHipotese(usuario, 'Freela', '80,00', { tipo: 'Entra' })
    await waitFor(() => expect(api.simulacao.salvar).toHaveBeenCalled(), { timeout: 3000 })

    expect(api.despesa.criarUnicaForaCartao).not.toHaveBeenCalled()
    expect(api.despesa.criarUnicaCredito).not.toHaveBeenCalled()
    expect(api.despesa.excluir).not.toHaveBeenCalled()
    expect(api.recebimento.criarAvulso).not.toHaveBeenCalled()
    expect(api.recebimento.marcarRecebido).not.toHaveBeenCalled()
    expect(api.renda.criarRecorrente).not.toHaveBeenCalled()
    // A visão mensal é usada, e só de leitura.
    expect(api.visaoMensal.detalhar).toHaveBeenCalled()
  })

  it('so habilita Adicionar com descricao e valor validos', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')

    const botao = screen.getByRole('button', { name: 'Adicionar' })
    expect((botao as HTMLButtonElement).disabled).toBe(true)

    await usuario.type(screen.getByLabelText('Descrição*'), 'Fim de semana')
    expect((botao as HTMLButtonElement).disabled).toBe(true)

    await usuario.type(screen.getByLabelText('Valor*'), 'abc')
    expect((botao as HTMLButtonElement).disabled).toBe(true)

    await usuario.clear(screen.getByLabelText('Valor*'))
    await usuario.type(screen.getByLabelText('Valor*'), '50')
    expect((botao as HTMLButtonElement).disabled).toBe(false)
  })

  it('limpar pede confirmacao e zera a lista', async () => {
    const usuario = userEvent.setup()
    instalarApiMock()
    renderPagina()
    await screen.findByText('Hipóteses')
    await adicionarHipotese(usuario, 'Fim de semana', '50,00')
    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*150,00/))

    await usuario.click(screen.getByRole('button', { name: 'Limpar simulação' }))
    await usuario.click(screen.getByRole('button', { name: 'Limpar' }))

    await waitFor(() => expect(saldoSimulado()).toMatch(/R\$\s*200,00/))
    expect(screen.queryByLabelText('Descrição da hipótese')).toBeNull()
  })
})
