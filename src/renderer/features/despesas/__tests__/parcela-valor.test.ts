import { describe, expect, it } from 'vitest'
import { valorTotalCentavosParcelada } from '../parcela-valor'

// A leitura do valor digitado mudou de casa: vive em `lib/dinheiro.ts` e e
// testada em `lib/__tests__/dinheiro.test.ts`. Aqui fica so a regra propria da
// parcelada — como o modo de entrada vira o total da compra.

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
