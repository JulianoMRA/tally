import { describe, it, expect } from 'vitest'
import { parseValorBrl } from '../valor-brl'

describe('parseValorBrl', () => {
  it.each([
    ['12,34', 1234],
    ['0,50', 50],
    ['1234', 123400],
    ['1.234,56', 123456],
    ['1.234.567,89', 123456789],
    ['12', 1200],
    ['12,3', 1230]
  ])('converte %s em %d centavos', (texto, esperado) => {
    expect(parseValorBrl(texto)).toBe(esperado)
  })

  it.each([
    ['', 'vazio'],
    ['abc', 'nao numerico'],
    ['-12,34', 'negativo'],
    ['12,345', 'tres casas decimais'],
    ['12.34', 'ponto como decimal (formato errado)'],
    ['1.23,45', 'milhar malformado'],
    ['R$ 12,34', 'prefixo de moeda']
  ])('rejeita %s (%s)', (texto) => {
    expect(() => parseValorBrl(texto)).toThrow()
  })
})
