import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { StatusFatura } from '@domain/entities/fatura'
import { cartao } from '../../../__tests__/__fixtures__/builders'
import { cartoesDoTrilho } from '../cartoes-do-trilho'
import type { GrupoFaturasCartao } from '../hooks/use-faturas'

let proximoId = 1

function fatura(status: StatusFatura['kind'], totalCentavos = 10000): FaturaComTotal {
  const id = proximoId++
  return {
    fatura: {
      id,
      cartaoId: 1,
      mesReferencia: '2026-08',
      dataFechamento: '2026-08-05',
      dataVencimento: '2026-08-12',
      status: status === 'Paga' ? { kind: 'Paga', pagaEm: '2026-08-10' } : { kind: status },
      createdAt: '',
      updatedAt: ''
    },
    mesReferencia: '2026-08',
    totalCentavos,
    pagoParcialCentavos: 0,
    restanteCentavos: totalCentavos
  }
}

function grupo(nome: string, ativo: boolean, faturas: FaturaComTotal[] = []): GrupoFaturasCartao {
  return { cartao: cartao({ nome, ativo }), faturas }
}

const nomes = (grupos: GrupoFaturasCartao[]) => grupos.map((g) => g.cartao.nome)

describe('cartoesDoTrilho', () => {
  it('mantém todo cartão ativo, mesmo sem fatura', () => {
    const grupos = [grupo('Inter', true), grupo('Nubank', true, [fatura('Paga')])]

    expect(nomes(cartoesDoTrilho(grupos, null))).toEqual(['Inter', 'Nubank'])
  })

  // Trocar de cartão com uma compra em 12x ainda correndo: o cartão velho é
  // arquivado, mas as faturas dele continuam no saldo (RN-08), na Visão mensal e
  // nos avisos do sistema. Fora do trilho, ninguém conseguia pagá-las.
  it('inclui o arquivado com fatura a pagar, depois dos ativos', () => {
    const grupos = [
      grupo('Antigo', false, [fatura('Fechada')]),
      grupo('Inter', true),
      grupo('Nubank', true)
    ]

    expect(nomes(cartoesDoTrilho(grupos, null))).toEqual(['Inter', 'Nubank', 'Antigo'])
  })

  it('deixa de fora o arquivado com tudo pago', () => {
    const grupos = [grupo('Inter', true), grupo('Antigo', false, [fatura('Paga')])]

    expect(nomes(cartoesDoTrilho(grupos, null))).toEqual(['Inter'])
  })

  // Fatura sem valor é resíduo de despesa excluída: não há o que pagar.
  it('deixa de fora o arquivado cuja fatura em aberto não tem valor', () => {
    const grupos = [grupo('Inter', true), grupo('Antigo', false, [fatura('Aberta', 0)])]

    expect(nomes(cartoesDoTrilho(grupos, null))).toEqual(['Inter'])
  })

  // O link da Visão mensal aponta para fatura de cartão arquivado mesmo quando
  // ela já foi paga, e pagar a última fatura dele não pode tirar do trilho o
  // cartão que o painel está mostrando.
  it('inclui o arquivado em foco, mesmo sem nada a pagar', () => {
    const antigo = grupo('Antigo', false, [fatura('Paga')])
    const grupos = [grupo('Inter', true), antigo]

    expect(nomes(cartoesDoTrilho(grupos, antigo.cartao.id))).toEqual(['Inter', 'Antigo'])
  })

  it('preserva a ordem de entrada dentro de ativos e de arquivados', () => {
    const grupos = [
      grupo('Zeta', false, [fatura('Fechada')]),
      grupo('Nubank', true),
      grupo('Alfa', false, [fatura('Aberta')]),
      grupo('Inter', true)
    ]

    expect(nomes(cartoesDoTrilho(grupos, null))).toEqual(['Nubank', 'Inter', 'Zeta', 'Alfa'])
  })
})
