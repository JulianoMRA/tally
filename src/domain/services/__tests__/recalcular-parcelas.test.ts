import { describe, expect, it } from 'vitest'
import type { Parcela } from '../../entities/parcela'
import { recalcularParcelasPendentes } from '../recalcular-parcelas'

function parcela(
  numero: number,
  status: 'Pendente' | 'Paga',
  valorCentavos: number,
  id?: number
): Parcela {
  return {
    id: id ?? numero,
    despesaId: 1,
    faturaId: 100 + numero,
    numero,
    total: 12,
    valorCentavos,
    dataReferencia: '2026-06',
    status,
    dataPagamento: status === 'Paga' ? '2026-06-12' : null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z'
  }
}

describe('recalcularParcelasPendentes (RF-DES-10)', () => {
  it('distribui igualmente quando todas as parcelas estao pendentes', () => {
    const parcelas = [parcela(1, 'Pendente', 100), parcela(2, 'Pendente', 100)]
    const resultado = recalcularParcelasPendentes(parcelas, 500)
    expect(resultado[0].valorCentavos).toBe(250)
    expect(resultado[1].valorCentavos).toBe(250)
  })

  it('mantem parcelas Paga intactas e distribui resto entre as Pendentes', () => {
    const parcelas = [
      parcela(1, 'Paga', 100),
      parcela(2, 'Pendente', 100),
      parcela(3, 'Pendente', 100)
    ]
    const resultado = recalcularParcelasPendentes(parcelas, 700)
    expect(resultado[0].valorCentavos).toBe(100) // Paga intacta
    expect(resultado[0].status).toBe('Paga')
    expect(resultado[1].valorCentavos).toBe(350)
    expect(resultado[2].valorCentavos).toBe(350)
  })

  it('coloca centavo extra na ultima parcela pendente (maior numero)', () => {
    const parcelas = [parcela(1, 'Pendente', 100), parcela(2, 'Pendente', 100)]
    const resultado = recalcularParcelasPendentes(parcelas, 101)
    expect(resultado[0].valorCentavos).toBe(50)
    expect(resultado[1].valorCentavos).toBe(51)
  })

  it('mesmo com parcelas fora de ordem na lista, ultima parcela pendente (maior numero) recebe o resto', () => {
    // Lista com numero 3 antes do numero 2
    const parcelas = [
      parcela(1, 'Paga', 100),
      parcela(3, 'Pendente', 100, 30),
      parcela(2, 'Pendente', 100, 20)
    ]
    const resultado = recalcularParcelasPendentes(parcelas, 101)
    const p2 = resultado.find((p) => p.numero === 2)!
    const p3 = resultado.find((p) => p.numero === 3)!
    expect(p2.valorCentavos).toBe(50)
    expect(p3.valorCentavos).toBe(51) // numero 3 e o maior dentre pendentes
  })

  it('lanca erro quando nao ha parcela pendente e valor > 0', () => {
    const parcelas = [parcela(1, 'Paga', 100)]
    expect(() => recalcularParcelasPendentes(parcelas, 500)).toThrow(/sem parcelas pendentes/i)
  })

  it('aceita lista vazia quando valor = 0', () => {
    expect(recalcularParcelasPendentes([], 0)).toEqual([])
  })

  it('rejeita valor negativo', () => {
    const parcelas = [parcela(1, 'Pendente', 100)]
    expect(() => recalcularParcelasPendentes(parcelas, -50)).toThrow(/>= 0/)
  })

  it('nao muta o array original', () => {
    const parcelas = [parcela(1, 'Pendente', 100), parcela(2, 'Pendente', 100)]
    const snapshot = JSON.parse(JSON.stringify(parcelas))
    recalcularParcelasPendentes(parcelas, 500)
    expect(parcelas).toEqual(snapshot)
  })
})
