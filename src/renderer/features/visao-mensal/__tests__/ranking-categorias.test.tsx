// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { montarRanking } from '../montar-ranking'
import { RankingCategorias } from '../RankingCategorias'

function total(categoriaId: number, categoriaNome: string): TotalPorCategoria {
  return { categoriaId, categoriaNome, cor: '#5a4a8a', totalCentavos: 10000 }
}

describe('RankingCategorias', () => {
  afterEach(cleanup)

  // Três terços: arredondar linha a linha exibia 33% três vezes, e a pizza ao
  // lado (RF-VIS-08) mostra 34/33/33.
  it('exibe na linha sem limite o percentual que soma 100 com as demais', () => {
    const linhas = montarRanking([total(1, 'Casa'), total(2, 'Mercado'), total(3, 'Lazer')], [])
    render(<RankingCategorias linhas={linhas} totalCentavos={30000} />)

    const itens = screen.getAllByRole('listitem')
    expect(within(itens[0]!).getByText('34%')).toBeTruthy()
    expect(within(itens[1]!).getByText('33%')).toBeTruthy()
    expect(within(itens[2]!).getByText('33%')).toBeTruthy()
  })
})
