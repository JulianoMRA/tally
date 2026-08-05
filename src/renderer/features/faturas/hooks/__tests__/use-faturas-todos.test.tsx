import { describe, expect, it } from 'vitest'
import type { Cartao } from '@domain/entities/cartao'
import type { Fatura } from '@domain/entities/fatura'
import { agruparFaturasPorCartao } from '../use-faturas'
import type { FaturaComTotal } from '@shared/ipc/fatura'

function cartao(id: number, nome: string): Cartao {
  return {
    id,
    nome,
    diaFechamento: 5,
    diaVencimento: 12,
    cor: '#abc',
    ativo: true,
    createdAt: '',
    updatedAt: ''
  }
}

function fatura(id: number, cartaoId: number): Fatura {
  return {
    id,
    cartaoId,
    mesReferencia: '2026-06',
    dataFechamento: '2026-06-05',
    dataVencimento: '2026-06-12',
    status: { kind: 'Aberta' },
    createdAt: '',
    updatedAt: ''
  }
}

/** A visão geral consome FaturaComTotal desde a fase 8: a lista precisa do valor. */
function comTotal(id: number, cartaoId: number, totalCentavos = 0): FaturaComTotal {
  const f = fatura(id, cartaoId)
  return { fatura: f, mesReferencia: f.mesReferencia, totalCentavos }
}

describe('agruparFaturasPorCartao', () => {
  it('casa cada cartão com a sua lista de faturas pelo índice', () => {
    const cartoes = [cartao(1, 'Inter'), cartao(2, 'Nubank')]
    const listas = [[comTotal(10, 1), comTotal(11, 1)], [comTotal(20, 2)]]

    expect(agruparFaturasPorCartao(cartoes, listas)).toEqual([
      { cartao: cartoes[0], faturas: [comTotal(10, 1), comTotal(11, 1)] },
      { cartao: cartoes[1], faturas: [comTotal(20, 2)] }
    ])
  })

  it('preserva a ordem dos cartões de entrada', () => {
    const cartoes = [cartao(3, 'C'), cartao(1, 'A'), cartao(2, 'B')]
    const listas = [[comTotal(30, 3)], [comTotal(10, 1)], [comTotal(20, 2)]]

    expect(agruparFaturasPorCartao(cartoes, listas).map((g) => g.cartao.id)).toEqual([3, 1, 2])
  })

  it('usa lista vazia quando o índice não tem faturas correspondentes', () => {
    const cartoes = [cartao(1, 'Inter')]

    expect(agruparFaturasPorCartao(cartoes, [])).toEqual([{ cartao: cartoes[0], faturas: [] }])
  })

  it('retorna vazio quando não há cartões', () => {
    expect(agruparFaturasPorCartao([], [])).toEqual([])
  })
})
