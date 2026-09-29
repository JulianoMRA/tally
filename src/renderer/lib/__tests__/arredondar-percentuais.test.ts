import { describe, expect, it } from 'vitest'
import { arredondarPercentuais } from '../arredondar-percentuais'

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('arredondarPercentuais', () => {
  it('fecha em 100 quando o arredondamento isolado daria 99', () => {
    // Math.round em cada terço daria 33 + 33 + 33.
    const pcts = arredondarPercentuais([1000, 1000, 1000])

    expect(pcts).toEqual([34, 33, 33])
    expect(soma(pcts)).toBe(100)
  })

  it('fecha em 100 quando o arredondamento isolado passaria de 100', () => {
    // Math.round em cada sexto daria 17 × 6 = 102.
    const pcts = arredondarPercentuais([500, 500, 500, 500, 500, 500])

    expect(pcts).toEqual([17, 17, 17, 17, 16, 16])
    expect(soma(pcts)).toBe(100)
  })

  it('dá o ponto que falta ao maior resto, não ao primeiro da lista', () => {
    // 87,4% e 12,6%: quem está mais perto de subir é o segundo.
    expect(arredondarPercentuais([8740, 1260])).toEqual([87, 13])
  })

  it('desempata restos iguais pela ordem da lista, que é a ordem do ranking', () => {
    expect(arredondarPercentuais([2, 1, 1])).toEqual([50, 25, 25])
    expect(arredondarPercentuais([1, 1])).toEqual([50, 50])
    expect(arredondarPercentuais([3, 3, 3, 1])).toEqual([30, 30, 30, 10])
    expect(arredondarPercentuais([1, 1, 1, 0])).toEqual([34, 33, 33, 0])
  })

  it('mantém intactos os percentuais que já são inteiros', () => {
    expect(arredondarPercentuais([5000, 2500, 2500])).toEqual([50, 25, 25])
  })

  it('dá 100 a um valor único', () => {
    expect(arredondarPercentuais([4200])).toEqual([100])
  })

  it('dá zero a quem tem valor zero, sem tirar ponto dos demais', () => {
    expect(arredondarPercentuais([6200, 0])).toEqual([100, 0])
  })

  it('devolve zeros quando o total é zero, em vez de dividir por zero', () => {
    expect(arredondarPercentuais([0, 0])).toEqual([0, 0])
  })

  it('devolve lista vazia para entrada vazia', () => {
    expect(arredondarPercentuais([])).toEqual([])
  })
})
