// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { LinhaOrcamentoComOrigem } from '@shared/ipc/orcamento'
import { OrcamentoPanel } from '../OrcamentoPanel'

function linha(overrides: Partial<LinhaOrcamentoComOrigem>): LinhaOrcamentoComOrigem {
  return {
    categoriaId: 1,
    categoriaNome: 'Mercado',
    cor: '#5b7a5e',
    limiteCentavos: 50000,
    realizadoCentavos: 28000,
    percentual: 56,
    status: 'ok',
    origem: 'global',
    ...overrides
  }
}

function instalarApiMock(progresso: LinhaOrcamentoComOrigem[]) {
  const api = {
    orcamento: {
      listarProgresso: vi.fn().mockResolvedValue(progresso),
      definirLimite: vi.fn(),
      removerLimite: vi.fn()
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

describe('OrcamentoPanel — rótulos de status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('rotula o status ok como "Dentro do limite", não como "No limite"', async () => {
    instalarApiMock([linha({ status: 'ok', percentual: 56 })])

    render(<OrcamentoPanel mes="2026-08" categorias={[]} />)

    expect(await screen.findByText(/56% · Dentro do limite/)).toBeTruthy()
    expect(screen.queryByText(/No limite/)).toBeNull()
  })

  it('mantém os rótulos de alerta e estourado', async () => {
    instalarApiMock([
      linha({ categoriaId: 1, categoriaNome: 'Lazer', status: 'alerta', percentual: 85 }),
      linha({ categoriaId: 2, categoriaNome: 'Casa', status: 'estourado', percentual: 150 })
    ])

    render(<OrcamentoPanel mes="2026-08" categorias={[]} />)

    expect(await screen.findByText(/85% · Atenção/)).toBeTruthy()
    expect(screen.getByText(/150% · Estourado/)).toBeTruthy()
  })
})
