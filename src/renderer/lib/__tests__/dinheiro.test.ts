import { describe, it, expect } from 'vitest'
import { centavosParaReais, ehValorValido, parseCentavos, valorReaisSchema } from '../dinheiro'
import { parseValorBrl } from '@shared/csv/valor-brl'

/**
 * Leitura e escrita de valor monetário digitado.
 *
 * Existia em cinco cópias de `parseCentavos`, três de `centavosParaReais` mais
 * uma inline, e dez do regex de validação — todas idênticas, espalhadas por
 * sete arquivos de tela. Num app de finanças, mudar a regra de entrada de valor
 * exigia dezoito edições coordenadas, e a que passasse batido viraria
 * divergência silenciosa.
 */
describe('parseCentavos', () => {
  describe('vírgula como decimal (o caminho comum)', () => {
    it.each([
      ['12,34', 1234],
      ['1234,56', 123456],
      ['0,07', 7],
      ['19,99', 1999],
      ['1,5', 150],
      ['1234', 123400],
      ['0', 0]
    ])('%s vale %d centavos', (entrada, esperado) => {
      expect(parseCentavos(entrada)).toBe(esperado)
    })
  })

  describe('ponto com dois papéis, resolvidos pelo que vem depois dele', () => {
    it('seguido de exatamente 3 dígitos é separador de milhar', () => {
      expect(parseCentavos('1.000')).toBe(100_000)
      expect(parseCentavos('12.345')).toBe(1_234_500)
      expect(parseCentavos('1.234.567')).toBe(123_456_700)
    })

    it('seguido de 1 ou 2 dígitos no fim é decimal — hábito de teclado numérico', () => {
      expect(parseCentavos('12.34')).toBe(1234)
      expect(parseCentavos('1.23')).toBe(123)
      expect(parseCentavos('1.5')).toBe(150)
    })

    it('convive com a vírgula: milhar no ponto, decimal na vírgula', () => {
      expect(parseCentavos('1.234,56')).toBe(123456)
      expect(parseCentavos('1.234.567,89')).toBe(12_345_678_9)
    })

    it('`1.234` é mil duzentos e trinta e quatro reais, não um e pouco', () => {
      // Tres casas decimais nao existem em real, entao a leitura de milhar e a
      // unica que sobra. E a mesma que o import de CSV ja fazia.
      expect(parseCentavos('1.234')).toBe(123_400)
    })
  })

  describe('rejeita o que não é valor', () => {
    it.each([
      ['1,234', 'três casas decimais'],
      ['1.23,45', 'agrupamento de milhar inválido'],
      ['1.234.56', 'ponto nos dois papéis na mesma string'],
      ['', 'vazio'],
      ['abc', 'texto'],
      ['-10,00', 'negativo'],
      ['R$ 10,00', 'símbolo de moeda'],
      ['10,00 ', 'espaço à direita'],
      ['1..234', 'ponto duplo'],
      [',50', 'sem parte inteira']
    ])('%s — %s', (entrada) => {
      expect(ehValorValido(entrada)).toBe(false)
      expect(() => parseCentavos(entrada)).toThrow()
    })
  })

  it('usa aritmética inteira, sem passar por float', () => {
    // `parseFloat(x) * 100` dava 1998.9999999999998 para '19,99' e so nao
    // errava por causa do Math.round. Com no maximo duas casas o arredondamento
    // sempre salvava, entao nunca houve bug — mas a conta inteira nao depende
    // disso para estar certa.
    for (let c = 0; c <= 300; c++) {
      const reais = centavosParaReais(c)
      expect(parseCentavos(reais)).toBe(c)
    }
  })
})

describe('centavosParaReais', () => {
  it.each([
    [1234, '12,34'],
    [7, '0,07'],
    [0, '0,00'],
    [150_000, '1500,00'],
    [123_456_789, '1234567,89']
  ])('%d centavos vira %s', (centavos, esperado) => {
    expect(centavosParaReais(centavos)).toBe(esperado)
  })

  it('não usa separador de milhar — o campo abre com o que ele mesmo aceita', () => {
    const texto = centavosParaReais(150_000)
    expect(texto).toBe('1500,00')
    expect(ehValorValido(texto)).toBe(true)
    expect(parseCentavos(texto)).toBe(150_000)
  })
})

describe('valorReaisSchema (para os formulários com zod)', () => {
  it('aceita o que o parseCentavos aceita', () => {
    for (const bom of ['12,34', '1.234,56', '12.34', '1.000', '1234']) {
      expect(valorReaisSchema.safeParse(bom).success).toBe(true)
    }
  })

  it('recusa com a mensagem que o formulário exibe', () => {
    const r = valorReaisSchema.safeParse('1,234')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Valor inválido')
  })
})

describe('relação com o parser do CSV (import de arquivo)', () => {
  /**
   * O import de CSV mantém gramática própria e mais estrita, de propósito: lá o
   * valor entra em lote e o usuário não vê o resultado antes de gravar. O
   * formulário é o oposto — o campo está na frente dele.
   *
   * O que precisa valer é a direção: tudo que o CSV aceita, o formulário
   * também. Assim não existe valor importável que não seja digitável, que era
   * a assimetria incômoda.
   */
  it.each(['12,34', '1.234,56', '1234', '1.000', '0,07', '1.234.567,89'])(
    'o formulário aceita %s com o mesmo valor que o CSV',
    (entrada) => {
      expect(parseCentavos(entrada)).toBe(parseValorBrl(entrada))
    }
  )

  it('o formulário é mais permissivo, e só nessa direção', () => {
    // O CSV recusa ponto como decimal (formato en-US num arquivo). O
    // formulario aceita, porque digitar 12.34 no teclado numerico e comum.
    expect(parseCentavos('12.34')).toBe(1234)
    expect(() => parseValorBrl('12.34')).toThrow()
  })
})
