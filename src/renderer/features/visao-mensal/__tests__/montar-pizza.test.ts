import { describe, it, expect } from 'vitest'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { montarPizza } from '../montar-pizza'
import { montarRanking } from '../montar-ranking'

function total(
  categoriaId: number,
  categoriaNome: string,
  totalCentavos: number,
  cor = '#5a4a8a'
): TotalPorCategoria {
  return { categoriaId, categoriaNome, cor, totalCentavos }
}

/** Sete categorias em ordem decrescente, como a query devolve. */
const SETE = [
  total(1, 'Casa', 70000, '#3f6e47'),
  total(2, 'Mercado', 60000, '#5b7a5e'),
  total(3, 'Transporte', 50000, '#a88454'),
  total(4, 'Lazer', 40000, '#8c3b2e'),
  total(5, 'Assinaturas', 30000, '#5a4a8a'),
  total(6, 'Saúde', 20000, '#1f6f8b'),
  total(7, 'Presentes', 10000, '#ff7a00')
]

describe('montarPizza — agrupamento', () => {
  it('dá uma fatia a cada categoria quando são até seis', () => {
    const fatias = montarPizza(SETE.slice(0, 6))

    expect(fatias).toHaveLength(6)
    expect(fatias.every((f) => f.tipo === 'categoria')).toBe(true)
  })

  // A pizza saiu em ago/2026 porque, com sete fatias, deixava de ser legível.
  // O teto de seis é o motivo da remoção virando requisito (RF-VIS-08).
  it('a partir de sete, mantém as cinco maiores e agrupa o resto em Outros', () => {
    const fatias = montarPizza(SETE)

    expect(fatias.map((f) => f.nome)).toEqual([
      'Casa',
      'Mercado',
      'Transporte',
      'Lazer',
      'Assinaturas',
      'Outros'
    ])
    const outros = fatias[5]
    expect(outros).toMatchObject({
      tipo: 'outros',
      totalCentavos: 30000,
      agrupadas: ['Saúde', 'Presentes']
    })
  })

  it('mantém a cor da própria categoria, a mesma da barra do ranking', () => {
    const fatias = montarPizza(SETE)

    expect(fatias[0]).toMatchObject({ tipo: 'categoria', cor: '#3f6e47' })
    expect(fatias[4]).toMatchObject({ tipo: 'categoria', cor: '#5a4a8a' })
  })

  it('deixa de fora categoria com total zero, sem que ela conte para o teto', () => {
    const fatias = montarPizza([...SETE.slice(0, 6), total(8, 'Parcela zero', 0)])

    expect(fatias).toHaveLength(6)
    expect(fatias.some((f) => f.tipo === 'outros')).toBe(false)
    expect(fatias.map((f) => f.nome)).not.toContain('Parcela zero')
  })

  it('não desenha nada sem gasto no mês, nem com todos os totais zerados', () => {
    expect(montarPizza([])).toEqual([])
    expect(montarPizza([total(1, 'Casa', 0), total(2, 'Mercado', 0)])).toEqual([])
  })
})

describe('montarPizza — ordem e percentuais', () => {
  it('vai do maior para o menor, mantendo a ordem da query nos empates', () => {
    const fatias = montarPizza([
      total(2, 'Mercado', 10000),
      total(1, 'Casa', 30000),
      total(3, 'Lazer', 10000)
    ])

    expect(fatias.map((f) => f.nome)).toEqual(['Casa', 'Mercado', 'Lazer'])
  })

  it('exibe os mesmos percentuais do ranking para a mesma entrada', () => {
    const tercos = [total(1, 'Casa', 10000), total(2, 'Mercado', 10000), total(3, 'Lazer', 10000)]

    const daPizza = montarPizza(tercos).map((f) => f.percentual)
    const doRanking = montarRanking(tercos, []).map((l) => l.fatiaPctExibida)

    expect(daPizza).toEqual([34, 33, 33])
    expect(daPizza).toEqual(doRanking)
  })

  it('dá a Outros a soma dos percentuais das agrupadas, e a legenda fecha em 100', () => {
    const ranking = montarRanking(SETE, [])
    const fatias = montarPizza(SETE)

    const somaAgrupadas = ranking.slice(5).reduce((s, l) => s + l.fatiaPctExibida, 0)
    expect(fatias[5]?.percentual).toBe(somaAgrupadas)
    expect(fatias.reduce((s, f) => s + f.percentual, 0)).toBe(100)
  })

  // Arredondar depois de agrupar também soma 100, mas diverge do ranking: aqui
  // Saúde (7,5%) e Presentes (6,5%) ganham os pontos que sobram antes de
  // Mercado (20,4%). Somados em "Outros" (14,0%), o ponto iria para Mercado,
  // que apareceria com 21% na pizza e 20% no ranking.
  it('arredonda antes de agrupar, senão Outros tiraria ponto das visíveis', () => {
    const totais = [
      total(1, 'Casa', 2540),
      total(2, 'Mercado', 2040),
      total(3, 'Transporte', 1540),
      total(4, 'Lazer', 1440),
      total(5, 'Assinaturas', 1040),
      total(6, 'Saúde', 750),
      total(7, 'Presentes', 650)
    ]

    const fatias = montarPizza(totais)
    const ranking = montarRanking(totais, [])

    expect(fatias.map((f) => f.percentual)).toEqual([26, 20, 15, 14, 10, 15])
    expect(fatias.slice(0, 5).map((f) => f.percentual)).toEqual(
      ranking.slice(0, 5).map((l) => l.fatiaPctExibida)
    )
  })
})

describe('montarPizza — geometria', () => {
  it('começa às 12h e segue em sentido horário, fechando em 360°', () => {
    const fatias = montarPizza([total(1, 'Casa', 30000), total(2, 'Mercado', 10000)])

    expect(fatias.map((f) => [f.inicioGraus, f.fimGraus])).toEqual([
      [0, 270],
      [270, 360]
    ])
  })

  // Os percentuais são arredondados para a legenda; o desenho não pode herdar
  // o erro do arredondamento, senão 34% viraria uma fatia visivelmente maior.
  it('reparte o círculo pelo valor exato, não pelo percentual arredondado', () => {
    const fatias = montarPizza([
      total(1, 'Casa', 10000),
      total(2, 'Mercado', 10000),
      total(3, 'Lazer', 10000)
    ])

    expect(fatias.map((f) => f.fimGraus - f.inicioGraus)).toEqual([120, 120, 120])
  })

  it('desenha metade e metade como dois semicírculos', () => {
    const fatias = montarPizza([total(1, 'Casa', 10000), total(2, 'Mercado', 10000)])

    expect(fatias.map((f) => f.caminho)).toEqual([
      'M 50 50 L 50 2 A 48 48 0 0 1 50 98 Z',
      'M 50 50 L 50 98 A 48 48 0 0 1 50 2 Z'
    ])
  })

  it('usa o arco grande na fatia que passa de 180°', () => {
    const fatias = montarPizza([total(1, 'Casa', 30000), total(2, 'Mercado', 10000)])

    expect(fatias[0]?.caminho).toBe('M 50 50 L 50 2 A 48 48 0 1 1 2 50 Z')
    expect(fatias[1]?.caminho).toBe('M 50 50 L 2 50 A 48 48 0 0 1 50 2 Z')
  })

  // Um arco só não fecha 360°: início e fim coincidem e o SVG não desenha
  // nada. O disco inteiro sai de dois semicírculos.
  it('desenha a categoria única como disco inteiro', () => {
    const fatias = montarPizza([total(1, 'Casa', 42000)])

    expect(fatias).toHaveLength(1)
    expect(fatias[0]).toMatchObject({ percentual: 100, inicioGraus: 0, fimGraus: 360 })
    expect(fatias[0]?.caminho).toBe('M 50 2 A 48 48 0 1 1 50 98 A 48 48 0 1 1 50 2 Z')
  })
})
