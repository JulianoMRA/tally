import { describe, it, expect } from 'vitest'
import { selecionarParcelasParaReplicarAjuda } from '../replicar-ajuda-recorrente'
import type { Parcela } from '../../entities/parcela'
import type { Fatura, StatusFatura } from '../../entities/fatura'

function parcela(id: number, numero: number, faturaId: number, total: number | null = 12): Parcela {
  return {
    id,
    despesaId: 100,
    faturaId,
    numero,
    total,
    valorCentavos: 1000,
    dataReferencia: `2026-${String(numero).padStart(2, '0')}`,
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

function fatura(id: number, status: StatusFatura): Fatura {
  return {
    id,
    cartaoId: 1,
    mesReferencia: `2026-${String(id).padStart(2, '0')}`,
    dataFechamento: '2026-01-05',
    dataVencimento: '2026-01-12',
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

describe('selecionarParcelasParaReplicarAjuda (RN-05)', () => {
  it('replica em todas as parcelas futuras quando todas estão em fatura Aberta', () => {
    const parcelas = [1, 2, 3, 4, 5].map((n) => parcela(n, n, n))
    const faturasIndex = new Map<number, Fatura>(
      [1, 2, 3, 4, 5].map((id) => [id, fatura(id, { kind: 'Aberta' })])
    )

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[1]) // origem = 2/12

    expect(alvo.map((p) => p.numero)).toEqual([3, 4, 5])
  })

  it('não replica em parcelas com fatura Fechada', () => {
    const parcelas = [1, 2, 3, 4, 5].map((n) => parcela(n, n, n))
    const faturasIndex = new Map<number, Fatura>([
      [1, fatura(1, { kind: 'Paga', pagaEm: '2026-01-12' })],
      [2, fatura(2, { kind: 'Aberta' })],
      [3, fatura(3, { kind: 'Fechada' })],
      [4, fatura(4, { kind: 'Fechada' })],
      [5, fatura(5, { kind: 'Aberta' })]
    ])

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[1]) // origem = 2/12

    expect(alvo.map((p) => p.numero)).toEqual([5])
  })

  it('não replica em parcelas com fatura Paga', () => {
    const parcelas = [1, 2, 3].map((n) => parcela(n, n, n))
    const faturasIndex = new Map<number, Fatura>([
      [1, fatura(1, { kind: 'Aberta' })],
      [2, fatura(2, { kind: 'Paga', pagaEm: '2026-02-12' })],
      [3, fatura(3, { kind: 'Aberta' })]
    ])

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[0]) // origem = 1
    expect(alvo.map((p) => p.numero)).toEqual([3])
  })

  it('retorna vazio quando origem é a última parcela', () => {
    const parcelas = [1, 2, 3].map((n) => parcela(n, n, n))
    const faturasIndex = new Map<number, Fatura>(
      [1, 2, 3].map((id) => [id, fatura(id, { kind: 'Aberta' })])
    )

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[2])
    expect(alvo).toEqual([])
  })

  it('retorna vazio quando há apenas uma parcela (despesa Única)', () => {
    const unica = parcela(1, 1, 1, 1)
    const faturasIndex = new Map<number, Fatura>([[1, fatura(1, { kind: 'Aberta' })]])

    const alvo = selecionarParcelasParaReplicarAjuda([unica], faturasIndex, unica)
    expect(alvo).toEqual([])
  })

  it('ignora parcelas com numero menor que a origem (passado)', () => {
    const parcelas = [1, 2, 3, 4, 5].map((n) => parcela(n, n, n))
    const faturasIndex = new Map<number, Fatura>(
      [1, 2, 3, 4, 5].map((id) => [id, fatura(id, { kind: 'Aberta' })])
    )

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[3]) // origem = 4
    expect(alvo.map((p) => p.numero)).toEqual([5])
  })

  it('parcela com faturaId=null (fora de cartão) é ignorada — escopo deste slice', () => {
    const parcelas = [
      parcela(1, 1, 1),
      { ...parcela(2, 2, 1), faturaId: null }, // fora de cartão hipotética
      parcela(3, 3, 3)
    ]
    const faturasIndex = new Map<number, Fatura>([
      [1, fatura(1, { kind: 'Aberta' })],
      [3, fatura(3, { kind: 'Aberta' })]
    ])

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[0])
    expect(alvo.map((p) => p.numero)).toEqual([3])
  })

  it('ordena por numero ascendente', () => {
    const parcelas = [parcela(1, 5, 5), parcela(2, 3, 3), parcela(3, 4, 4), parcela(4, 2, 2)]
    const faturasIndex = new Map<number, Fatura>(
      [2, 3, 4, 5].map((id) => [id, fatura(id, { kind: 'Aberta' })])
    )

    const alvo = selecionarParcelasParaReplicarAjuda(parcelas, faturasIndex, parcelas[3]) // numero 2
    expect(alvo.map((p) => p.numero)).toEqual([3, 4, 5])
  })
})
