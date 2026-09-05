import { describe, expect, it } from 'vitest'
import type { Despesa } from '@domain/entities/despesa'
import type { Parcela } from '@domain/entities/parcela'
import { dataParcelaExibida } from '../data-parcela'

function parcela(overrides: Partial<Parcela> = {}): Parcela {
  return {
    id: 1,
    despesaId: 10,
    faturaId: 5,
    numero: 2,
    total: 3,
    valorCentavos: 5000,
    dataReferencia: '2026-07-01',
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '2026-05-15T12:00:00Z',
    updatedAt: '2026-05-15T12:00:00Z',
    ...overrides
  }
}

function despesa(overrides: Partial<Despesa> = {}): Despesa {
  return {
    id: 10,
    descricao: 'Notebook',
    categoriaId: 1,
    tipo: 'Parcelada',
    formaPagamento: 'Credito',
    cartaoId: 1,
    valorCentavos: 15000,
    totalParcelas: 3,
    dataCompra: '2026-05-15',
    diaCobranca: null,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '2026-05-15T12:00:00Z',
    updatedAt: '2026-05-15T12:00:00Z',
    ...overrides
  }
}

describe('dataParcelaExibida', () => {
  it('usa a data real da compra para despesa Parcelada', () => {
    // Parcelas 2..N caem em meses seguintes, mas todas exibem a data da compra
    expect(dataParcelaExibida(parcela(), despesa({ tipo: 'Parcelada' }))).toBe('2026-05-15')
  })

  it('usa a data real da compra para despesa Unica', () => {
    expect(dataParcelaExibida(parcela(), despesa({ tipo: 'Unica' }))).toBe('2026-05-15')
  })

  it('mantém a competência mensal para Assinatura', () => {
    expect(dataParcelaExibida(parcela(), despesa({ tipo: 'Assinatura' }))).toBe('2026-07-01')
  })

  it('usa a competência como fallback quando a despesa não está disponível', () => {
    expect(dataParcelaExibida(parcela(), undefined)).toBe('2026-07-01')
  })

  it('devolve ISO sem formatação, para ordenação cronológica por string', () => {
    const exibida = dataParcelaExibida(parcela(), despesa())
    expect(exibida).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
