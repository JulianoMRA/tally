import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { escolherFaturaCorrente, resolverFaturaDoDeepLink } from '../escolher-fatura-corrente'

let proximoId = 1

type Opcoes = {
  status?: StatusFatura['kind']
  /** Padrão: dia 12 do próprio mês, como um cartão que vence depois de fechar. */
  vencimento?: string
  totalCentavos?: number
}

function fatura(mesReferencia: string, opcoes: Opcoes = {}): FaturaComTotal {
  const { status = 'Aberta', vencimento = `${mesReferencia}-12`, totalCentavos = 10000 } = opcoes
  const id = proximoId++
  return {
    fatura: {
      id,
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: vencimento,
      status: status === 'Paga' ? { kind: 'Paga', pagaEm: vencimento } : { kind: status },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    mesReferencia,
    totalCentavos,
    pagoParcialCentavos: 0,
    restanteCentavos: totalCentavos
  }
}

describe('escolherFaturaCorrente', () => {
  it('escolhe a fatura do mês atual quando ela é a única a pagar', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-07', { status: 'Paga' }), fatura('2026-08'), fatura('2026-09')],
      '2026-08'
    )

    expect(escolhida?.mesReferencia).toBe('2026-08')
  })

  // O caso que motivou a regra: cartão que fecha no dia 24 e vence no dia 01.
  // A fatura de setembro vence em 01/10 — no dia 01 o mês atual já é outubro,
  // e a regra antiga ("o mês atual primeiro") trocava o card pela fatura nova,
  // Aberta, justo no dia de pagar a anterior.
  it('no dia 01, o cartão que vence no mês seguinte continua na fatura que vence agora', () => {
    const escolhida = escolherFaturaCorrente(
      [
        fatura('2026-09', { status: 'Fechada', vencimento: '2026-10-01' }),
        fatura('2026-10', { vencimento: '2026-11-01' })
      ],
      '2026-10'
    )

    expect(escolhida?.mesReferencia).toBe('2026-09')
  })

  it('com a fatura do mês paga, escolhe a próxima, que é a que está acumulando', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-09', { status: 'Paga' }), fatura('2026-10')],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-10')
  })

  it('a fatura vencida do mês anterior vem antes da do mês atual', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-08', { status: 'Fechada' }), fatura('2026-09', { status: 'Fechada' })],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-08')
  })

  // A janela de um mês existe por quem importou histórico ou não marca as
  // faturas como pagas: sem ela, o card mostraria a fatura mais antiga do
  // cartão, "vencida há 200 dias", até alguém pagar uma por uma. As dívidas
  // mais antigas ficam no Histórico.
  it('fatura não paga de dois meses atrás não toma o card', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-07', { status: 'Fechada' }), fatura('2026-09')],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-09')
  })

  // Fatura sem valor é resíduo — sobra de uma despesa excluída ou de um
  // adiantamento — e não há o que pagar nela.
  it('fatura sem valor não conta como a pagar', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-09', { totalCentavos: 0 }), fatura('2026-10')],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-10')
  })

  it('só com faturas futuras, escolhe a de vencimento mais próximo', () => {
    const escolhida = escolherFaturaCorrente([fatura('2026-11'), fatura('2026-10')], '2026-08')

    expect(escolhida?.mesReferencia).toBe('2026-10')
  })

  it('com vencimentos iguais, escolhe a de mês anterior', () => {
    const escolhida = escolherFaturaCorrente(
      [
        fatura('2026-10', { vencimento: '2026-10-12' }),
        fatura('2026-09', { status: 'Fechada', vencimento: '2026-10-12' })
      ],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-09')
  })

  it('sem nada a pagar na janela, escolhe a mais recente', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-05', { status: 'Fechada' }), fatura('2026-06', { status: 'Fechada' })],
      '2026-08'
    )

    expect(escolhida?.mesReferencia).toBe('2026-06')
  })

  it('com tudo pago, escolhe a mais recente', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-09', { status: 'Paga' }), fatura('2026-08', { status: 'Paga' })],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-09')
  })

  it('não depende da ordem em que as faturas chegam', () => {
    const escolhida = escolherFaturaCorrente(
      [fatura('2026-10'), fatura('2026-09'), fatura('2026-08', { status: 'Paga' })],
      '2026-09'
    )

    expect(escolhida?.mesReferencia).toBe('2026-09')
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
  const LISTA = [fatura('2026-07', { status: 'Paga' }), fatura('2026-08')]

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
