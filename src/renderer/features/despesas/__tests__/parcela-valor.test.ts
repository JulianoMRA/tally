import { describe, expect, it } from 'vitest'
import { parseCentavos, valorTotalCentavosParcelada } from '../parcela-valor'

describe('parseCentavos', () => {
  it('converte reais com vírgula em centavos', () => {
    expect(parseCentavos('1234,56')).toBe(123456)
    expect(parseCentavos('40')).toBe(4000)
    expect(parseCentavos('0,99')).toBe(99)
  })

  it('aceita ponto como separador decimal', () => {
    expect(parseCentavos('12.50')).toBe(1250)
  })
})

describe('valorTotalCentavosParcelada', () => {
  it('no modo total usa o valor digitado como total da compra', () => {
    expect(valorTotalCentavosParcelada('total', '120,00', 3)).toBe(12000)
  })

  it('no modo parcela multiplica o valor da parcela pelo número de parcelas', () => {
    expect(valorTotalCentavosParcelada('parcela', '40,00', 3)).toBe(12000)
  })

  it('arredonda para centavos antes de multiplicar (sem erro de ponto flutuante)', () => {
    // 33,34 por parcela × 3 = 100,02 exatos; distribuirCentavos não sobra resto.
    expect(valorTotalCentavosParcelada('parcela', '33,34', 3)).toBe(10002)
  })
})
