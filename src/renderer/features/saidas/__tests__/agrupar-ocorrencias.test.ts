import { describe, it, expect } from 'vitest'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { cartao, categoria } from '../../../__tests__/__fixtures__/builders'
import { agruparPorCategoria, agruparPorOrigem } from '../agrupar-ocorrencias'

let proximoId = 1

function ocorrencia(overrides: Partial<OcorrenciaDoMes> = {}): OcorrenciaDoMes {
  const id = proximoId++
  return {
    parcelaId: id,
    despesaId: id,
    descricao: 'Compra',
    categoriaId: 1,
    cartaoId: 1,
    formaPagamento: 'Credito',
    tipo: 'Unica',
    dataCompra: '2026-08-14',
    dataReferencia: '2026-08-01',
    faturaId: 1,
    statusParcela: 'Pendente',
    ativa: true,
    nota: null,
    tags: [],
    impactoCentavos: 10000,
    origemCentavos: null,
    rotuloParcela: 'à vista',
    progressoPct: null,
    ...overrides
  }
}

const CARTOES = [
  cartao({ id: 1, nome: 'Nubank', cor: '#5a4a8a' }),
  cartao({ id: 2, nome: 'Inter', cor: '#a88454' })
]

describe('agruparPorOrigem', () => {
  it('cria uma seção por cartão, nomeada e colorida pelo cartão', () => {
    const grupos = agruparPorOrigem(
      [ocorrencia({ cartaoId: 1 }), ocorrencia({ cartaoId: 2 })],
      CARTOES
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Nubank', 'Inter'])
    expect(grupos.map((g) => g.cor)).toEqual(['#5a4a8a', '#a88454'])
  })

  it('junta ocorrências do mesmo cartão e soma o impacto', () => {
    const grupos = agruparPorOrigem(
      [
        ocorrencia({ cartaoId: 1, impactoCentavos: 41658 }),
        ocorrencia({ cartaoId: 1, impactoCentavos: 4490 })
      ],
      CARTOES
    )

    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.itens).toHaveLength(2)
    expect(grupos[0]?.totalCentavos).toBe(46148)
  })

  // O subtotal soma IMPACTO, nunca o valor de origem — é o que faz o número
  // bater com o total da fatura na tela de Faturas.
  it('soma o impacto do mês, não o valor cheio da compra', () => {
    const grupos = agruparPorOrigem(
      [ocorrencia({ cartaoId: 1, impactoCentavos: 41658, origemCentavos: 499900 })],
      CARTOES
    )

    expect(grupos[0]?.totalCentavos).toBe(41658)
  })

  it('agrupa o que sai da conta sob "Fora do cartão", sem cor', () => {
    const grupos = agruparPorOrigem(
      [ocorrencia({ cartaoId: null, formaPagamento: 'Pix' })],
      CARTOES
    )

    expect(grupos[0]?.rotulo).toBe('Fora do cartão')
    expect(grupos[0]?.cor).toBeUndefined()
  })

  // Cartão tem prazo de fechamento a acompanhar; o que já saiu da conta, não.
  it('empurra "Fora do cartão" para o fim, mesmo vindo primeiro', () => {
    const grupos = agruparPorOrigem(
      [ocorrencia({ cartaoId: null }), ocorrencia({ cartaoId: 1 })],
      CARTOES
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Nubank', 'Fora do cartão'])
  })

  it('preserva a ordem de aparição entre cartões', () => {
    const grupos = agruparPorOrigem(
      [ocorrencia({ cartaoId: 2 }), ocorrencia({ cartaoId: 1 }), ocorrencia({ cartaoId: 2 })],
      CARTOES
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Inter', 'Nubank'])
    expect(grupos[0]?.itens).toHaveLength(2)
  })

  it('cai para o id quando o cartão não é conhecido', () => {
    const grupos = agruparPorOrigem([ocorrencia({ cartaoId: 99 })], CARTOES)

    expect(grupos[0]?.rotulo).toBe('#99')
    expect(grupos[0]?.cor).toBeUndefined()
  })

  it('devolve lista vazia sem ocorrências', () => {
    expect(agruparPorOrigem([], CARTOES)).toEqual([])
  })

  it('não muta o array de entrada', () => {
    const itens = [ocorrencia({ cartaoId: 1 })]
    agruparPorOrigem(itens, CARTOES)

    expect(itens).toHaveLength(1)
  })
})

describe('agruparPorCategoria', () => {
  const lazer = categoria({ id: 1, nome: 'Lazer', cor: '#8c3b2e' })
  const casa = categoria({ id: 2, nome: 'Casa', cor: '#3f6e47' })
  const viagem = categoria({ id: 3, nome: 'Viagem', cor: '#2f7f7a', ativo: false })
  const mercado = categoria({ id: 4, nome: 'Mercado', cor: '#5b7a5e' })
  const CATEGORIAS = [lazer, casa, viagem, mercado]

  it('cria uma seção por categoria, com nome, cor e subtotal', () => {
    const grupos = agruparPorCategoria(
      [
        ocorrencia({ categoriaId: 1, impactoCentavos: 26000 }),
        ocorrencia({ categoriaId: 1, impactoCentavos: 4000 })
      ],
      CATEGORIAS
    )

    expect(grupos).toEqual([
      expect.objectContaining({
        chave: 'categoria-1',
        rotulo: 'Lazer',
        cor: '#8c3b2e',
        arquivada: false,
        totalCentavos: 30000
      })
    ])
    expect(grupos[0]?.itens).toHaveLength(2)
  })

  // A mesma ordem do ranking da Visão mensal: a pergunta que o agrupamento
  // responde é "para onde foi o dinheiro", e a resposta começa pelo maior.
  it('ordena as seções pela soma, da maior para a menor', () => {
    const grupos = agruparPorCategoria(
      [
        ocorrencia({ categoriaId: 4, impactoCentavos: 8500 }),
        ocorrencia({ categoriaId: 2, impactoCentavos: 25000 }),
        ocorrencia({ categoriaId: 1, impactoCentavos: 26000 })
      ],
      CATEGORIAS
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Lazer', 'Casa', 'Mercado'])
  })

  it('desempata pelo nome, em ordem alfabética', () => {
    const grupos = agruparPorCategoria(
      [
        ocorrencia({ categoriaId: 4, impactoCentavos: 5000 }),
        ocorrencia({ categoriaId: 2, impactoCentavos: 5000 })
      ],
      CATEGORIAS
    )

    expect(grupos.map((g) => g.rotulo)).toEqual(['Casa', 'Mercado'])
  })

  it('a soma das seções é o total do mês', () => {
    const itens = [
      ocorrencia({ categoriaId: 1, impactoCentavos: 12249 }),
      ocorrencia({ categoriaId: 2, impactoCentavos: 7300 }),
      ocorrencia({ categoriaId: 1, impactoCentavos: 590 })
    ]

    const grupos = agruparPorCategoria(itens, CATEGORIAS)

    expect(grupos.reduce((s, g) => s + g.totalCentavos, 0)).toBe(20139)
  })

  it('marca a categoria arquivada, para o cabeçalho levar o selo', () => {
    const grupos = agruparPorCategoria([ocorrencia({ categoriaId: 3 })], CATEGORIAS)

    expect(grupos[0]?.arquivada).toBe(true)
  })

  it('cai para o id, sem cor, quando a categoria não é conhecida', () => {
    const grupos = agruparPorCategoria([ocorrencia({ categoriaId: 9 })], CATEGORIAS)

    expect(grupos[0]?.rotulo).toBe('#9')
    expect(grupos[0]?.cor).toBeUndefined()
  })

  // A ordenação escolhida no cabeçalho age dentro de cada seção: o agrupamento
  // não reordena as linhas que recebe.
  it('mantém dentro da seção a ordem em que as linhas chegaram', () => {
    const a = ocorrencia({ categoriaId: 1, descricao: 'A' })
    const b = ocorrencia({ categoriaId: 1, descricao: 'B' })

    expect(agruparPorCategoria([b, a], CATEGORIAS)[0]?.itens).toEqual([b, a])
  })
})
