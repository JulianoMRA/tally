import { describe, it, expect } from 'vitest'
import { ocorrencia } from '../../../__tests__/__fixtures__/builders'
import {
  FILTROS_PADRAO,
  contarPorTipo,
  filtrarOcorrencias,
  filtrarPorDescricao,
  temFiltroAtivo,
  tipoDaOcorrencia,
  type FiltrosDeSaidas
} from '../filtrar-saidas'

const itens = [
  { descricao: 'Café da manhã' },
  { descricao: 'Almoço no centro' },
  { descricao: 'CAFETERIA premium' },
  { descricao: 'Uber' }
]

describe('filtrarPorDescricao', () => {
  it('busca vazia ou só espaços devolve tudo (cópia)', () => {
    expect(filtrarPorDescricao(itens, '')).toHaveLength(4)
    expect(filtrarPorDescricao(itens, '   ')).toHaveLength(4)
  })

  it('ignora acentos nos dois sentidos', () => {
    expect(filtrarPorDescricao(itens, 'cafe').map((i) => i.descricao)).toEqual([
      'Café da manhã',
      'CAFETERIA premium'
    ])
    expect(filtrarPorDescricao(itens, 'almoco').map((i) => i.descricao)).toEqual([
      'Almoço no centro'
    ])
  })

  it('ignora caixa', () => {
    expect(filtrarPorDescricao(itens, 'UBER').map((i) => i.descricao)).toEqual(['Uber'])
  })

  it('casa por trecho (substring)', () => {
    expect(filtrarPorDescricao(itens, 'centro')).toHaveLength(1)
  })

  it('sem correspondência devolve vazio', () => {
    expect(filtrarPorDescricao(itens, 'xyz')).toEqual([])
  })
})

describe('tipoDaOcorrencia', () => {
  // À vista é a despesa única em QUALQUER forma de pagamento: a aba antiga
  // "Fora do cartão" misturava origem com tipo, e as compras à vista no crédito
  // não tinham aba nenhuma.
  it('classifica despesa única como à vista, no crédito ou fora dele', () => {
    expect(tipoDaOcorrencia(ocorrencia({ tipo: 'Unica', formaPagamento: 'Credito' }))).toBe(
      'avista'
    )
    expect(tipoDaOcorrencia(ocorrencia({ tipo: 'Unica', formaPagamento: 'Pix' }))).toBe('avista')
  })

  it('classifica parcelada e assinatura, com ou sem cartão', () => {
    expect(tipoDaOcorrencia(ocorrencia({ tipo: 'Parcelada' }))).toBe('parcelada')
    expect(tipoDaOcorrencia(ocorrencia({ tipo: 'Assinatura', cartaoId: null }))).toBe('assinatura')
  })
})

describe('filtrarOcorrencias', () => {
  const mercado = ocorrencia({ descricao: 'Mercado', categoriaId: 1, cartaoId: 1, tags: ['casa'] })
  const gpu = ocorrencia({ descricao: 'GPU', tipo: 'Parcelada', categoriaId: 2, cartaoId: 2 })
  const aluguel = ocorrencia({
    descricao: 'Aluguel',
    tipo: 'Assinatura',
    categoriaId: 1,
    cartaoId: null,
    formaPagamento: 'Pix',
    faturaId: null
  })
  const feira = ocorrencia({
    descricao: 'Feira',
    categoriaId: 1,
    cartaoId: null,
    formaPagamento: 'Pix',
    faturaId: null
  })
  const todas = [mercado, gpu, aluguel, feira]

  function com(filtros: Partial<FiltrosDeSaidas>) {
    return filtrarOcorrencias(todas, { ...FILTROS_PADRAO, ...filtros })
  }

  it('sem filtro devolve tudo', () => {
    expect(com({})).toEqual(todas)
  })

  it('filtra por tipo', () => {
    expect(com({ tipo: 'avista' })).toEqual([mercado, feira])
    expect(com({ tipo: 'assinatura' })).toEqual([aluguel])
  })

  it('filtra por cartão pela chave de origem', () => {
    expect(com({ origem: 'cartao-2' })).toEqual([gpu])
  })

  // O defeito 7: a aba "Fora do cartão" contava só compra única, e a
  // recorrente no Pix aparecia no grupo "Fora do cartão" mas sumia da aba.
  it('"Fora do cartão" é tudo o que não tem cartão, inclusive a recorrente', () => {
    expect(com({ origem: 'fora-do-cartao' })).toEqual([aluguel, feira])
  })

  it('filtra por categoria', () => {
    expect(com({ categoria: '2' })).toEqual([gpu])
  })

  it('filtra por tag', () => {
    expect(com({ tag: 'casa' })).toEqual([mercado])
  })

  it('combina os filtros por E', () => {
    expect(com({ categoria: '1', origem: 'fora-do-cartao', tipo: 'avista' })).toEqual([feira])
    expect(com({ categoria: '1', busca: 'alu' })).toEqual([aluguel])
  })
})

describe('contarPorTipo', () => {
  const lista = [
    ocorrencia({ tipo: 'Unica', categoriaId: 1 }),
    ocorrencia({ tipo: 'Unica', categoriaId: 2, cartaoId: null, formaPagamento: 'Pix' }),
    ocorrencia({ tipo: 'Parcelada', categoriaId: 1 }),
    ocorrencia({ tipo: 'Assinatura', categoriaId: 2 })
  ]

  it('as três abas somam Todas', () => {
    const c = contarPorTipo(lista, FILTROS_PADRAO)

    expect(c).toEqual({ todas: 4, avista: 2, parcelada: 1, assinatura: 1 })
    expect(c.avista + c.parcelada + c.assinatura).toBe(c.todas)
  })

  // A aba conta o que apareceria se fosse clicada: com Categoria = 1,
  // "Parceladas 1" são as parceladas daquela categoria.
  it('respeita os outros filtros', () => {
    expect(contarPorTipo(lista, { ...FILTROS_PADRAO, categoria: '1' })).toEqual({
      todas: 2,
      avista: 1,
      parcelada: 1,
      assinatura: 0
    })
  })

  // Contar respeitando o próprio tipo zeraria as outras abas assim que uma
  // fosse escolhida, e elas deixariam de dizer para onde dá para ir.
  it('ignora o tipo escolhido', () => {
    expect(contarPorTipo(lista, { ...FILTROS_PADRAO, tipo: 'parcelada' })).toEqual(
      contarPorTipo(lista, FILTROS_PADRAO)
    )
  })
})

describe('temFiltroAtivo', () => {
  it('é falso no padrão e com busca só de espaços', () => {
    expect(temFiltroAtivo(FILTROS_PADRAO)).toBe(false)
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, busca: '   ' })).toBe(false)
  })

  it('é verdadeiro com qualquer filtro fora do padrão', () => {
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, tipo: 'avista' })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, origem: 'fora-do-cartao' })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, categoria: '3' })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, tag: 'viagem' })).toBe(true)
    expect(temFiltroAtivo({ ...FILTROS_PADRAO, busca: 'uber' })).toBe(true)
  })
})
