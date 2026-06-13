import { describe, expect, it } from 'vitest'
import { buildFaturasSearch, parseFaturasSearch } from '../faturas-search'

describe('parseFaturasSearch', () => {
  it('extrai cartaoId e faturaId quando ambos são inteiros positivos', () => {
    const params = new URLSearchParams('cartaoId=3&faturaId=12')
    expect(parseFaturasSearch(params)).toEqual({ cartaoId: 3, faturaId: 12 })
  })

  it('retorna null para parâmetros ausentes', () => {
    expect(parseFaturasSearch(new URLSearchParams(''))).toEqual({
      cartaoId: null,
      faturaId: null
    })
  })

  it('retorna null para valores não numéricos', () => {
    const params = new URLSearchParams('cartaoId=abc&faturaId=x')
    expect(parseFaturasSearch(params)).toEqual({ cartaoId: null, faturaId: null })
  })

  it('rejeita zero, negativos e frações', () => {
    expect(parseFaturasSearch(new URLSearchParams('cartaoId=0&faturaId=-1'))).toEqual({
      cartaoId: null,
      faturaId: null
    })
    expect(parseFaturasSearch(new URLSearchParams('cartaoId=1.5'))).toEqual({
      cartaoId: null,
      faturaId: null
    })
  })

  it('aceita apenas cartaoId quando faturaId está ausente', () => {
    expect(parseFaturasSearch(new URLSearchParams('cartaoId=7'))).toEqual({
      cartaoId: 7,
      faturaId: null
    })
  })
})

describe('buildFaturasSearch', () => {
  it('monta a query string com cartaoId e faturaId', () => {
    expect(buildFaturasSearch(3, 12)).toBe('cartaoId=3&faturaId=12')
  })

  it('faz round-trip com parseFaturasSearch', () => {
    const search = buildFaturasSearch(5, 9)
    expect(parseFaturasSearch(new URLSearchParams(search))).toEqual({
      cartaoId: 5,
      faturaId: 9
    })
  })
})
