import { describe, it, expect } from 'vitest'
import { serializarCsv, formatarValorCsv } from '../gerar-csv'
import { parseCsv } from '../parse-csv'
import { parseValorBrl } from '../valor-brl'

describe('serializarCsv', () => {
  it('gera header + linhas com ponto-e-virgula e quebra \\n', () => {
    const csv = serializarCsv(
      ['a', 'b'],
      [
        ['1', '2'],
        ['3', '4']
      ]
    )
    expect(csv).toBe('a;b\n1;2\n3;4\n')
  })

  it('cita campos com delimitador, aspas ou quebra de linha', () => {
    const csv = serializarCsv(
      ['descricao'],
      [['tem;delimitador'], ['tem "aspas"'], ['tem\nquebra']]
    )
    expect(csv).toBe('descricao\n"tem;delimitador"\n"tem ""aspas"""\n"tem\nquebra"\n')
  })

  it('faz round-trip com o parseCsv da importação', () => {
    const header = ['descricao', 'valor']
    const linhas = [
      ['Almoço; com arroz', '25,90'],
      ['Disse "oi"', '1.234,56']
    ]
    const resultado = parseCsv(serializarCsv(header, linhas))
    expect(resultado.header).toEqual(header)
    expect(resultado.linhas).toEqual(linhas)
  })
})

describe('formatarValorCsv', () => {
  it.each([
    [1234, '12,34'],
    [50, '0,50'],
    [123400, '1234,00'],
    [123456789, '1234567,89'],
    [0, '0,00']
  ])('formata %d centavos como %s', (centavos, esperado) => {
    expect(formatarValorCsv(centavos)).toBe(esperado)
  })

  it('é o inverso de parseValorBrl', () => {
    for (const c of [1, 99, 100, 12345, 999999901]) {
      expect(parseValorBrl(formatarValorCsv(c))).toBe(c)
    }
  })
})
