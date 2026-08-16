import { describe, it, expect } from 'vitest'
import type { LinhaOrcamentoComOrigem } from '@shared/ipc/orcamento'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { montarRanking } from '../montar-ranking'

function total(overrides: Partial<TotalPorCategoria> = {}): TotalPorCategoria {
  return {
    categoriaId: 1,
    categoriaNome: 'Casa',
    cor: '#5a4a8a',
    totalCentavos: 62000,
    ...overrides
  }
}

function limite(overrides: Partial<LinhaOrcamentoComOrigem> = {}): LinhaOrcamentoComOrigem {
  return {
    categoriaId: 1,
    categoriaNome: 'Casa',
    cor: '#5a4a8a',
    limiteCentavos: 60000,
    realizadoCentavos: 62000,
    percentual: 103,
    status: 'estourado',
    origem: 'global',
    ...overrides
  }
}

describe('montarRanking — escala das barras', () => {
  it('dá 100% de largura à maior categoria e proporcional às demais', () => {
    const linhas = montarRanking(
      [
        total({ categoriaId: 1, totalCentavos: 62000 }),
        total({ categoriaId: 2, categoriaNome: 'Mercado', totalCentavos: 31000 })
      ],
      []
    )

    expect(linhas[0]?.larguraPct).toBe(100)
    expect(linhas[1]?.larguraPct).toBe(50)
  })

  it('calcula a fatia de cada categoria sobre o gasto total, não sobre a maior', () => {
    const linhas = montarRanking(
      [
        total({ categoriaId: 1, totalCentavos: 60000 }),
        total({ categoriaId: 2, categoriaNome: 'Mercado', totalCentavos: 20000 })
      ],
      []
    )

    expect(linhas[0]?.fatiaPct).toBe(75)
    expect(linhas[1]?.fatiaPct).toBe(25)
  })

  it('preserva a ordem recebida — quem ordena é a query', () => {
    const linhas = montarRanking(
      [
        total({ categoriaId: 2, categoriaNome: 'Mercado', totalCentavos: 10000 }),
        total({ categoriaId: 1, categoriaNome: 'Casa', totalCentavos: 90000 })
      ],
      []
    )

    expect(linhas.map((l) => l.nome)).toEqual(['Mercado', 'Casa'])
  })
})

describe('montarRanking — marca de limite', () => {
  it('posiciona a marca na mesma escala da barra', () => {
    const linhas = montarRanking(
      [total({ categoriaId: 1, totalCentavos: 100000 })],
      [limite({ categoriaId: 1, limiteCentavos: 80000, percentual: 125, status: 'estourado' })]
    )

    expect(linhas[0]?.larguraPct).toBe(100)
    expect(linhas[0]?.limite).toMatchObject({ posicaoPct: 80, usoPct: 125, status: 'estourado' })
  })

  // A escala é o maior GASTO, não o maior limite: este painel é primeiro um
  // ranking. Um limite generoso numa categoria pequena não pode encolher a
  // barra da maior categoria do mês.
  it('não deixa um limite grande achatar as barras das demais categorias', () => {
    const linhas = montarRanking(
      [
        total({ categoriaId: 1, categoriaNome: 'Casa', totalCentavos: 40000 }),
        total({ categoriaId: 2, categoriaNome: 'Mercado', totalCentavos: 8500 })
      ],
      [limite({ categoriaId: 2, limiteCentavos: 94400, percentual: 9, status: 'ok' })]
    )

    expect(linhas[0]?.larguraPct).toBe(100)
  })

  it('encosta a marca no fim quando o limite passa da escala, e sinaliza', () => {
    // Escala = 100000 (Casa, a maior). Mercado gastou 50000 e tem limite de
    // 150000, acima da escala.
    const linhas = montarRanking(
      [
        total({ categoriaId: 1, categoriaNome: 'Casa', totalCentavos: 100000 }),
        total({ categoriaId: 2, categoriaNome: 'Mercado', totalCentavos: 50000 })
      ],
      [
        limite({
          categoriaId: 2,
          categoriaNome: 'Mercado',
          limiteCentavos: 150000,
          percentual: 33,
          status: 'ok'
        })
      ]
    )

    expect(linhas[1]?.larguraPct).toBe(50)
    expect(linhas[1]?.limite).toMatchObject({ posicaoPct: 100, foraDeEscala: true })
  })

  it('limite dentro da escala não é sinalizado como fora', () => {
    const linhas = montarRanking(
      [total({ categoriaId: 1, totalCentavos: 100000 })],
      [limite({ categoriaId: 1, limiteCentavos: 100000, percentual: 100, status: 'estourado' })]
    )

    expect(linhas[0]?.limite).toMatchObject({ posicaoPct: 100, foraDeEscala: false })
  })

  it('categoria sem limite definido não ganha marca', () => {
    const linhas = montarRanking([total({ categoriaId: 1 })], [])

    expect(linhas[0]?.limite).toBeNull()
  })

  it('limite zerado não vira marca — dividir por ele daria posição infinita', () => {
    const linhas = montarRanking(
      [total({ categoriaId: 1 })],
      [limite({ categoriaId: 1, limiteCentavos: 0 })]
    )

    expect(linhas[0]?.limite).toBeNull()
  })

  it('ignora limite de categoria que não gastou nada no mês', () => {
    const linhas = montarRanking(
      [total({ categoriaId: 1, totalCentavos: 62000 })],
      [limite({ categoriaId: 99, categoriaNome: 'Lazer', limiteCentavos: 500000 })]
    )

    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.limite).toBeNull()
    expect(linhas[0]?.larguraPct).toBe(100)
  })
})

describe('montarRanking — bordas', () => {
  it('devolve lista vazia sem totais', () => {
    expect(montarRanking([], [])).toEqual([])
  })

  it('não divide por zero quando todas as categorias estão zeradas', () => {
    const linhas = montarRanking([total({ totalCentavos: 0 })], [])

    expect(linhas[0]?.larguraPct).toBe(0)
    expect(linhas[0]?.fatiaPct).toBe(0)
  })
})
