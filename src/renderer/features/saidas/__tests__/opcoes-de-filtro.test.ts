import { describe, it, expect } from 'vitest'
import { cartao, categoria, ocorrencia } from '../../../__tests__/__fixtures__/builders'
import { opcoesDeCategoria, opcoesDeOrigem, opcoesDeTag } from '../opcoes-de-filtro'

describe('opcoesDeOrigem', () => {
  const nubank = cartao({ id: 1, nome: 'Nubank' })
  const inter = cartao({ id: 2, nome: 'Inter' })
  const c6 = cartao({ id: 3, nome: 'C6' })
  const cartoes = [nubank, inter, c6]

  it('lista os cartões do mês em ordem alfabética e "Fora do cartão" por último', () => {
    const lista = [
      ocorrencia({ cartaoId: 1 }),
      ocorrencia({ cartaoId: null, formaPagamento: 'Pix' }),
      ocorrencia({ cartaoId: 2 }),
      ocorrencia({ cartaoId: 1 })
    ]

    expect(opcoesDeOrigem(lista, cartoes, '')).toEqual([
      { valor: 'cartao-2', rotulo: 'Inter' },
      { valor: 'cartao-1', rotulo: 'Nubank' },
      { valor: 'fora-do-cartao', rotulo: 'Fora do cartão' }
    ])
  })

  it('não oferece cartão sem lançamento no mês', () => {
    expect(opcoesDeOrigem([ocorrencia({ cartaoId: 1 })], cartoes, '')).toEqual([
      { valor: 'cartao-1', rotulo: 'Nubank' }
    ])
  })

  // Os filtros sobrevivem à troca de mês. Sem a escolhida entre as opções, o
  // select controlado mostraria "Todas as origens" enquanto filtra.
  it('mantém a origem escolhida mesmo sem lançamento no mês', () => {
    expect(opcoesDeOrigem([ocorrencia({ cartaoId: 1 })], cartoes, 'cartao-3')).toEqual([
      { valor: 'cartao-3', rotulo: 'C6' },
      { valor: 'cartao-1', rotulo: 'Nubank' }
    ])
    expect(opcoesDeOrigem([], cartoes, 'fora-do-cartao')).toEqual([
      { valor: 'fora-do-cartao', rotulo: 'Fora do cartão' }
    ])
  })

  it('não quebra com cartão que a lista ainda não carregou', () => {
    expect(opcoesDeOrigem([ocorrencia({ cartaoId: 9 })], [], '')).toEqual([
      { valor: 'cartao-9', rotulo: '#9' }
    ])
  })
})

describe('opcoesDeCategoria', () => {
  const lazer = categoria({ id: 1, nome: 'Lazer' })
  const casa = categoria({ id: 2, nome: 'Casa' })
  const viagem = categoria({ id: 3, nome: 'Viagem', ativo: false })
  const mercado = categoria({ id: 4, nome: 'Mercado' })
  const categorias = [casa, lazer, mercado, viagem]

  it('lista as categorias do mês, ativas em ordem alfabética e arquivadas no fim', () => {
    const lista = [
      ocorrencia({ categoriaId: 3 }),
      ocorrencia({ categoriaId: 1 }),
      ocorrencia({ categoriaId: 2 }),
      ocorrencia({ categoriaId: 1 })
    ]

    expect(opcoesDeCategoria(lista, categorias, '')).toEqual([
      { valor: '2', rotulo: 'Casa' },
      { valor: '1', rotulo: 'Lazer' },
      { valor: '3', rotulo: 'Viagem (arquivada)' }
    ])
  })

  it('mantém a categoria escolhida mesmo sem lançamento no mês', () => {
    expect(opcoesDeCategoria([ocorrencia({ categoriaId: 1 })], categorias, '4')).toEqual([
      { valor: '1', rotulo: 'Lazer' },
      { valor: '4', rotulo: 'Mercado' }
    ])
  })

  it('não quebra com categoria que a lista ainda não carregou', () => {
    expect(opcoesDeCategoria([ocorrencia({ categoriaId: 9 })], [], '')).toEqual([
      { valor: '9', rotulo: '#9' }
    ])
  })
})

describe('opcoesDeTag', () => {
  it('lista as tags do mês em ordem alfabética, sem repetir', () => {
    const lista = [ocorrencia({ tags: ['viagem', 'carro'] }), ocorrencia({ tags: ['carro'] })]

    expect(opcoesDeTag(lista, '')).toEqual(['carro', 'viagem'])
  })

  // O defeito: com uma tag escolhida num mês sem tags, o select sumia e o
  // filtro continuava valendo — lista vazia sem nada na tela que explicasse.
  it('mantém a tag escolhida mesmo sem ela no mês', () => {
    expect(opcoesDeTag([], 'viagem')).toEqual(['viagem'])
  })
})
