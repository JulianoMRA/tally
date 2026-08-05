import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { filtrarPorStatus, particionarPorMes, somarTotais } from '../organizar-faturas'

function fatura(
  mesReferencia: string,
  status: StatusFatura = { kind: 'Aberta' },
  totalCentavos = 10_000
): FaturaComTotal {
  return {
    mesReferencia,
    totalCentavos,
    fatura: {
      id: Number(mesReferencia.replace('-', '')),
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status,
      createdAt: '',
      updatedAt: ''
    }
  }
}

describe('filtrarPorStatus', () => {
  const lista = [
    fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-12' }),
    fatura('2026-07', { kind: 'Fechada' }),
    fatura('2026-08', { kind: 'Aberta' })
  ]

  it('devolve tudo quando o filtro é "todas"', () => {
    expect(filtrarPorStatus(lista, 'todas')).toHaveLength(3)
  })

  it('filtra por cada status do ciclo de vida', () => {
    expect(filtrarPorStatus(lista, 'Aberta').map((f) => f.mesReferencia)).toEqual(['2026-08'])
    expect(filtrarPorStatus(lista, 'Fechada').map((f) => f.mesReferencia)).toEqual(['2026-07'])
    expect(filtrarPorStatus(lista, 'Paga').map((f) => f.mesReferencia)).toEqual(['2026-06'])
  })

  it('não muta a lista original', () => {
    const original = [...lista]
    filtrarPorStatus(lista, 'Aberta')
    expect(lista).toEqual(original)
  })
})

describe('particionarPorMes', () => {
  it('põe o mês atual entre as correntes, não entre as anteriores', () => {
    const lista = [fatura('2026-06'), fatura('2026-07'), fatura('2026-08'), fatura('2026-09')]

    const { anteriores, correntes } = particionarPorMes(lista, '2026-08')

    expect(anteriores.map((f) => f.mesReferencia)).toEqual(['2026-06', '2026-07'])
    expect(correntes.map((f) => f.mesReferencia)).toEqual(['2026-08', '2026-09'])
  })

  it('lida com virada de ano comparando string ISO, não número', () => {
    const lista = [fatura('2025-12'), fatura('2026-01')]

    const { anteriores, correntes } = particionarPorMes(lista, '2026-01')

    expect(anteriores.map((f) => f.mesReferencia)).toEqual(['2025-12'])
    expect(correntes.map((f) => f.mesReferencia)).toEqual(['2026-01'])
  })

  it('devolve tudo em correntes quando não há passado', () => {
    const { anteriores, correntes } = particionarPorMes([fatura('2026-08')], '2026-08')

    expect(anteriores).toEqual([])
    expect(correntes).toHaveLength(1)
  })
})

describe('somarTotais', () => {
  it('soma os totais das faturas', () => {
    expect(
      somarTotais([fatura('2026-07', undefined, 1_000), fatura('2026-08', undefined, 2_500)])
    ).toBe(3_500)
  })

  it('devolve zero para lista vazia', () => {
    expect(somarTotais([])).toBe(0)
  })
})
