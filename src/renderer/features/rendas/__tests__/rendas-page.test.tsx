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
    rendaNome: 'Bolsa PET',
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

  it('usa "Esperado" para recebimento não recebido, alinhado ao domínio e ao filtro', async () => {
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
    // Dois "Esperado": o botão do filtro e o status da linha.
    expect(screen.getAllByText('Esperado').length).toBeGreaterThanOrEqual(2)
  })

  it('mantém "Recebido" com a data quando o recebimento já entrou', async () => {
    instalarApiMock([recebimento({ status: 'Recebido', dataRecebida: '2026-08-06' })])

    render(
      <ToastProvider>
        <RendasPage />
      </ToastProvider>
    )

    expect(await screen.findByText(/Recebido 06\/08\/2026/)).toBeTruthy()
  })
})
