import { describe, it, expect } from 'vitest'
import { fecharFatura, pagarFatura, reabrirFatura, precisaAutoFechar } from '../ciclo-fatura'
import type { Fatura } from '../../entities/fatura'

function faturaBase(overrides: Partial<Fatura> = {}): Fatura {
  return {
    id: 1,
    cartaoId: 1,
    mesReferencia: '2026-04',
    dataFechamento: '2026-04-05',
    dataVencimento: '2026-04-12',
    status: { kind: 'Aberta' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('precisaAutoFechar (RN-06)', () => {
  it('retorna true quando fatura Aberta e data_fechamento <= hoje', () => {
    const fatura = faturaBase({ dataFechamento: '2026-04-05' })
    expect(precisaAutoFechar(fatura, '2026-04-05')).toBe(true)
  })

  it('retorna true quando hoje é depois do fechamento', () => {
    const fatura = faturaBase({ dataFechamento: '2026-04-05' })
    expect(precisaAutoFechar(fatura, '2026-04-10')).toBe(true)
  })

  it('retorna false quando hoje é antes do fechamento', () => {
    const fatura = faturaBase({ dataFechamento: '2026-04-05' })
    expect(precisaAutoFechar(fatura, '2026-04-04')).toBe(false)
  })

  it('retorna false quando fatura já está Fechada', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    expect(precisaAutoFechar(fatura, '2026-04-10')).toBe(false)
  })

  it('retorna false quando fatura está Paga', () => {
    const fatura = faturaBase({ status: { kind: 'Paga', pagaEm: '2026-04-10' } })
    expect(precisaAutoFechar(fatura, '2026-04-10')).toBe(false)
  })
})

describe('fecharFatura (RN-06)', () => {
  it('Aberta → Fechada com sucesso', () => {
    const fatura = faturaBase({ status: { kind: 'Aberta' } })
    const resultado = fecharFatura(fatura)
    expect(resultado).toEqual({ ok: true, novoStatus: { kind: 'Fechada' } })
  })

  it('Fechada → erro: já está fechada', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    const resultado = fecharFatura(fatura)
    expect(resultado.ok).toBe(false)
  })

  it('Paga → erro: não pode fechar fatura paga', () => {
    const fatura = faturaBase({ status: { kind: 'Paga', pagaEm: '2026-04-10' } })
    const resultado = fecharFatura(fatura)
    expect(resultado.ok).toBe(false)
  })
})

describe('pagarFatura (RN-06)', () => {
  it('Fechada → Paga com data de pagamento', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    const resultado = pagarFatura(fatura, '2026-04-12')
    expect(resultado).toEqual({ ok: true, novoStatus: { kind: 'Paga', pagaEm: '2026-04-12' } })
  })

  it('Aberta → erro: deve fechar antes de pagar', () => {
    const fatura = faturaBase({ status: { kind: 'Aberta' } })
    const resultado = pagarFatura(fatura, '2026-04-12')
    expect(resultado.ok).toBe(false)
  })

  it('Paga → erro: já está paga', () => {
    const fatura = faturaBase({ status: { kind: 'Paga', pagaEm: '2026-04-10' } })
    const resultado = pagarFatura(fatura, '2026-04-12')
    expect(resultado.ok).toBe(false)
  })

  it('data de pagamento inválida → erro', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    const resultado = pagarFatura(fatura, '12/04/2026')
    expect(resultado.ok).toBe(false)
  })

  it('data de pagamento vazia → erro', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    const resultado = pagarFatura(fatura, '')
    expect(resultado.ok).toBe(false)
  })
})

describe('reabrirFatura (RF-FAT-05)', () => {
  it('Paga → Aberta com sucesso', () => {
    const fatura = faturaBase({ status: { kind: 'Paga', pagaEm: '2026-04-10' } })
    const resultado = reabrirFatura(fatura)
    expect(resultado).toEqual({ ok: true, novoStatus: { kind: 'Aberta' } })
  })

  it('Fechada → erro: só reabre fatura paga', () => {
    const fatura = faturaBase({ status: { kind: 'Fechada' } })
    const resultado = reabrirFatura(fatura)
    expect(resultado.ok).toBe(false)
  })

  it('Aberta → erro: não está paga', () => {
    const fatura = faturaBase({ status: { kind: 'Aberta' } })
    const resultado = reabrirFatura(fatura)
    expect(resultado.ok).toBe(false)
  })
})
