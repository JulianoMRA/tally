import { describe, it, expect } from 'vitest'
import type { Fatura } from '@domain/entities/fatura'
import { rotuloFechamento } from '../aviso-fechamento'

function fatura(overrides: Partial<Fatura> = {}): Fatura {
  return {
    id: 1,
    cartaoId: 1,
    mesReferencia: '2026-07',
    dataFechamento: '2026-07-20',
    dataVencimento: '2026-07-27',
    status: { kind: 'Aberta' },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides
  }
}

describe('rotuloFechamento', () => {
  it('retorna "fecha hoje" no dia do fechamento', () => {
    expect(rotuloFechamento(fatura(), '2026-07-20')).toBe('fecha hoje')
  })

  it('retorna "fecha amanhã" na véspera', () => {
    expect(rotuloFechamento(fatura(), '2026-07-19')).toBe('fecha amanhã')
  })

  it('retorna "fecha em N dias" dentro do limiar', () => {
    expect(rotuloFechamento(fatura(), '2026-07-16')).toBe('fecha em 4 dias')
    expect(rotuloFechamento(fatura(), '2026-07-13')).toBe('fecha em 7 dias')
  })

  it('retorna null fora do limiar ou com fechamento passado', () => {
    expect(rotuloFechamento(fatura(), '2026-07-12')).toBeNull()
    expect(rotuloFechamento(fatura(), '2026-07-21')).toBeNull()
  })

  it('retorna null para faturas Fechada ou Paga', () => {
    expect(rotuloFechamento(fatura({ status: { kind: 'Fechada' } }), '2026-07-19')).toBeNull()
    expect(
      rotuloFechamento(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-19' } }), '2026-07-19')
    ).toBeNull()
  })
})
