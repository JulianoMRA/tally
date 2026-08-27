// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { ToastProvider } from '../../../components/ui'
import RendasPage from '../RendasPage'

function recebimento(overrides: Partial<RecebimentoComContexto> = {}): RecebimentoComContexto {
  return {
    id: 1,
    rendaId: 10,
    descricao: null,
    nome: 'Bolsa PET',
    valorCentavos: 90000,
    dataEsperada: '2026-08-05',
    dataRecebida: null,
    status: 'Esperado',
    ...overrides
  } as RecebimentoComContexto
}

function instalarApiMock(recebimentos: RecebimentoComContexto[]) {
  const api = {
    // A aba de recebimentos carrega as fontes avulsas para o modal de avulso.
    renda: {
      list: vi.fn().mockResolvedValue([])
    },
    recebimento: {
      listar: vi.fn().mockResolvedValue(recebimentos),
      marcarRecebido: vi.fn(),
      criarAvulso: vi.fn(),
      excluir: vi.fn()
    },
    // A barra de progresso compara o mês com a média dos anteriores.
    relatorio: {
      evolucaoSaldo: vi.fn().mockResolvedValue([])
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

describe('RendasPage — status do recebimento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  // As duas colunas de data viraram uma frase só (ponto 15). O que estes testes
  // travam segue sendo o mesmo: a linha não pode usar rótulo divergente do
  // domínio, e recebimento que entrou tem que dizer quando.
  it('descreve recebimento não recebido como previsto, nunca como "Pendente"', async () => {
    instalarApiMock([recebimento()])

    render(
      <ToastProvider>
        <RendasPage />
      </ToastProvider>
    )

    expect(await screen.findByText('Bolsa PET')).toBeTruthy()
    // "Pendente" era o rótulo antigo: divergia de StatusRecebimento, da Visão
    // mensal e do próprio filtro desta tela.
    expect(screen.queryByText('Pendente')).toBeNull()
    expect(screen.getByText(/^previsto para 05\/08/)).toBeTruthy()
    // O filtro continua usando o vocabulário do domínio.
    expect(screen.getByRole('radio', { name: 'Esperado' })).toBeTruthy()
  })

  it('diz quando o dinheiro caiu, sem repetir a data esperada', async () => {
    instalarApiMock([recebimento({ status: 'Recebido', dataRecebida: '2026-08-06' })])

    render(
      <ToastProvider>
        <RendasPage />
      </ToastProvider>
    )

    expect(await screen.findByText('na conta em 06/08')).toBeTruthy()
    // A data esperada não aparece mais numa coluna própria.
    expect(screen.queryByText(/esperada/)).toBeNull()
  })
})
