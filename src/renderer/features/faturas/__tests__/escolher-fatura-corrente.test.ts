import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { escolherFaturaCorrente, resolverFaturaDoDeepLink } from '../escolher-fatura-corrente'

let proximoId = 1

function fatura(mesReferencia: string, status: StatusFatura['kind'] = 'Aberta'): FaturaComTotal {
  const id = proximoId++
  return {
    fatura: {
      id,
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status:
        status === 'Paga' ? { kind: 'Paga', pagaEm: `${mesReferencia}-12` } : { kind: status },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    mesReferencia,
    totalCentavos: 10000
  }
}

describe('escolherFaturaCorrente', () => {
  it('escolhe a fatura do mês atual quando ela existe', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-07'), fatura('2026-08'), fatura('2026-09')],
      '2026-08'
    )

    expect(escolhida?.mesReferencia).toBe('2026-08')
  })

  // Cartão sem compra no mês não tem fatura do mês. O que interessa nesse caso
  // é a próxima a vencer, não a mais antiga esquecida lá atrás.
  it('sem fatura do mês, escolhe a mais próxima no futuro', () => {
    const escolhida = escolherFaturaCorrente([fatura('2026-06'), fatura('2026-10')], '2026-08')

    expect(escolhida?.mesReferencia).toBe('2026-10')
  })

  it('sem fatura do mês nem futura, escolhe a mais recente do passado', () => {
    const escolhida = escolherFaturaCorrente([fatura('2026-05'), fatura('2026-06')], '2026-08')

    expect(escolhida?.mesReferencia).toBe('2026-06')
  })

  it('não depende da ordem em que as faturas chegam', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-09'), fatura('2026-08'), fatura('2026-07')],
      '2026-08'
    )

    expect(escolhida?.mesReferencia).toBe('2026-08')
  })

  it('cartão sem fatura nenhuma devolve null', () => {
    expect(escolherFaturaCorrente([], '2026-08')).toBeNull()
  })

  it('não muta a lista recebida', () => {
    const lista = [fatura('2026-09'), fatura('2026-07')]
    escolherFaturaCorrente(lista, '2026-08')

    expect(lista.map((f) => f.mesReferencia)).toEqual(['2026-09', '2026-07'])
  })
})

describe('resolverFaturaDoDeepLink', () => {
  const LISTA = [fatura('2026-07'), fatura('2026-08')]

  it('abre a fatura pedida quando ela existe', () => {
    const alvo = LISTA[0]!.fatura.id
    const r = resolverFaturaDoDeepLink(LISTA, alvo, '2026-08')

    expect(r.fatura?.fatura.id).toBe(alvo)
    expect(r.linkQuebrado).toBe(false)
  })

  // Decisão de ago/2026: com lista e detalhe fundidos não há estado vazio para
  // onde cair, então o link morto abre a fatura corrente e avisa — em vez de
  // deixar a tela num beco com botão "Voltar".
  it('cai na fatura corrente e sinaliza quando a fatura pedida sumiu', () => {
    const r = resolverFaturaDoDeepLink(LISTA, 999, '2026-08')

    expect(r.fatura?.mesReferencia).toBe('2026-08')
    expect(r.linkQuebrado).toBe(true)
  })

  it('sem fatura pedida, abre a corrente sem sinalizar nada', () => {
    const r = resolverFaturaDoDeepLink(LISTA, null, '2026-08')

    expect(r.fatura?.mesReferencia).toBe('2026-08')
    expect(r.linkQuebrado).toBe(false)
  })

  it('cartão sem faturas devolve null sem sinalizar link quebrado', () => {
    const r = resolverFaturaDoDeepLink([], null, '2026-08')

    expect(r.fatura).toBeNull()
    expect(r.linkQuebrado).toBe(false)
  })

  // Pedir fatura num cartão que não tem nenhuma ainda é link morto: a diferença
  // com o caso acima é a intenção registrada na URL.
  it('cartão sem faturas com id pedido sinaliza link quebrado', () => {
    const r = resolverFaturaDoDeepLink([], 999, '2026-08')

    expect(r.fatura).toBeNull()
    expect(r.linkQuebrado).toBe(true)
  })
})
