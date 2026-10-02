import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { contarPorStatus, filtrarPorStatus, somarAPagar } from '../organizar-faturas'

function fatura(
  mesReferencia: string,
  status: StatusFatura = { kind: 'Aberta' },
  totalCentavos = 10_000,
  pagoParcialCentavos = 0
): FaturaComTotal {
  return {
    mesReferencia,
    totalCentavos,
    pagoParcialCentavos,
    restanteCentavos: totalCentavos - pagoParcialCentavos,
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

  // Fatura de mês passado costuma estar Fechada, mas pode estar Aberta: ela
  // nasce Aberta e só fecha quando a manutenção roda. "A pagar" junta as duas,
  // e por isso as abas somam "Todas" em qualquer estado.
  it('"a pagar" é tudo que não está pago, Aberta ou Fechada', () => {
    expect(filtrarPorStatus(lista, 'a-pagar').map((f) => f.mesReferencia)).toEqual([
      '2026-07',
      '2026-08'
    ])
  })

  it('"pagas" é só o que está pago', () => {
    expect(filtrarPorStatus(lista, 'pagas').map((f) => f.mesReferencia)).toEqual(['2026-06'])
  })

  it('não muta a lista original', () => {
    const original = [...lista]
    filtrarPorStatus(lista, 'a-pagar')
    expect(lista).toEqual(original)
  })
})

describe('contarPorStatus', () => {
  it('conta cada aba, e "a pagar" mais "pagas" dá "todas"', () => {
    const lista = [
      fatura('2026-05', { kind: 'Paga', pagaEm: '2026-05-12' }),
      fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-12' }),
      fatura('2026-07', { kind: 'Fechada' }),
      fatura('2026-08', { kind: 'Aberta' })
    ]

    expect(contarPorStatus(lista)).toEqual({ todas: 4, 'a-pagar': 2, pagas: 2 })
  })

  it('lista vazia conta zero em tudo', () => {
    expect(contarPorStatus([])).toEqual({ todas: 0, 'a-pagar': 0, pagas: 0 })
  })
})

/**
 * RN-10 — a barra do Histórico diz quanto falta pagar nas faturas da lista.
 *
 * Ela somava o "restante" de todas, pagas inclusive, num número sem rótulo: em
 * "Todas", o que falta das não pagas com o que foi quitado das pagas. Duas
 * grandezas diferentes numa conta só, e nada na tela dizendo qual era qual.
 */
describe('somarAPagar', () => {
  it('soma o que falta nas faturas não pagas, Aberta ou Fechada', () => {
    expect(
      somarAPagar([
        fatura('2026-07', { kind: 'Fechada' }, 1_000),
        fatura('2026-08', { kind: 'Aberta' }, 2_500)
      ])
    ).toBe(3_500)
  })

  it('desconta o que já foi pago em parciais', () => {
    expect(
      somarAPagar([
        fatura('2026-07', { kind: 'Fechada' }, 1_000, 400),
        fatura('2026-08', { kind: 'Fechada' }, 2_500)
      ])
    ).toBe(3_100)
  })

  // A fatura paga não tem nada a pagar, mesmo com "restante" maior que zero:
  // nela o restante é o que foi quitado ao marcar como paga.
  it('deixa as pagas de fora', () => {
    expect(
      somarAPagar([
        fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-12' }, 4_000),
        fatura('2026-07', { kind: 'Fechada' }, 1_000)
      ])
    ).toBe(1_000)
  })

  it('devolve zero para lista vazia ou só de pagas', () => {
    expect(somarAPagar([])).toBe(0)
    expect(somarAPagar([fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-12' })])).toBe(0)
  })
})
