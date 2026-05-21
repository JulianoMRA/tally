import { describe, expect, it } from 'vitest'
import { agregarPorCategoria } from '../agregar-por-categoria'

describe('agregarPorCategoria', () => {
  it('retorna array vazio quando entrada vazia', () => {
    expect(agregarPorCategoria([])).toEqual([])
  })

  it('soma valores agrupados por categoriaId', () => {
    const r = agregarPorCategoria([
      { categoriaId: 1, valorCentavos: 1000 },
      { categoriaId: 2, valorCentavos: 500 },
      { categoriaId: 1, valorCentavos: 200 }
    ])
    expect(r).toEqual([
      { categoriaId: 1, totalCentavos: 1200 },
      { categoriaId: 2, totalCentavos: 500 }
    ])
  })

  it('ordena por totalCentavos decrescente', () => {
    const r = agregarPorCategoria([
      { categoriaId: 1, valorCentavos: 100 },
      { categoriaId: 2, valorCentavos: 900 },
      { categoriaId: 3, valorCentavos: 500 }
    ])
    expect(r.map((x) => x.categoriaId)).toEqual([2, 3, 1])
  })

  it('preserva categoriaId mesmo com soma zero', () => {
    const r = agregarPorCategoria([
      { categoriaId: 5, valorCentavos: 0 },
      { categoriaId: 7, valorCentavos: 100 }
    ])
    expect(r).toEqual([
      { categoriaId: 7, totalCentavos: 100 },
      { categoriaId: 5, totalCentavos: 0 }
    ])
  })
})
