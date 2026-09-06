import { describe, expect, it } from 'vitest'
import { textoPreviaParcelamento, valorTotalCentavosParcelada } from '../parcela-valor'

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

// A previa vivia inline no `DespesaForm`, com `parseFloat(valor.replace(',', '.'))`
// — o unico ponto do app que nao passava pelo `parseCentavos`. Com separador de
// milhar o replace produzia '2.500.00', que o parseFloat le como 2.5: a previa
// errava por tres ordens de grandeza no formato que o proprio campo aceita.
describe('textoPreviaParcelamento', () => {
  // O formatador pt-BR separa 'R$' do numero com NBSP (U+00A0), nao espaco comum.
  const NB = ' '

  it('no modo total divide o total pelo numero de parcelas', () => {
    expect(textoPreviaParcelamento('total', '120,00', 3)).toBe(`≈ R$${NB}40,00 por parcela`)
  })

  it('no modo parcela multiplica pelo numero de parcelas', () => {
    expect(textoPreviaParcelamento('parcela', '40,00', 3)).toBe(`= R$${NB}120,00 no total`)
  })

  it('respeita o separador de milhar que o campo aceita', () => {
    expect(textoPreviaParcelamento('total', '2.500,00', 12)).toBe(`≈ R$${NB}208,33 por parcela`)
    expect(textoPreviaParcelamento('parcela', '2.500,00', 12)).toBe(`= R$${NB}30.000,00 no total`)
  })

  it('devolve null enquanto o valor digitado ainda nao e valido', () => {
    expect(textoPreviaParcelamento('total', '', 3)).toBeNull()
    expect(textoPreviaParcelamento('total', '12,', 3)).toBeNull()
  })

  it('devolve null quando o numero de parcelas nao e utilizavel', () => {
    expect(textoPreviaParcelamento('total', '120,00', 0)).toBeNull()
    expect(textoPreviaParcelamento('total', '120,00', Number.NaN)).toBeNull()
  })
})
