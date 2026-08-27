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

/**
 * Excel, LibreOffice e Google Sheets avaliam como fórmula qualquer célula que
 * comece com `=`, `+`, `-` ou `@`. Uma descrição digitada pelo usuário — ou
 * vinda de um CSV importado de terceiro — chega ao export como texto puro e
 * sairia executável do outro lado.
 */
describe('serializarCsv — neutralização de fórmula', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+1+1', "'+1+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ["=cmd|'/c calc'!A1", "'=cmd|'/c calc'!A1"],
    ['\tcomeça com tab', "'\tcomeça com tab"],
    ['\rcomeça com CR', "'\rcomeça com CR"]
  ])('prefixa apóstrofo em %j, que a planilha avaliaria', (entrada, esperado) => {
    expect(parseCsv(serializarCsv(['descricao'], [[entrada]])).linhas[0][0]).toBe(esperado)
  })

  it('neutraliza texto que começa com hífen — a planilha tenta avaliar a subtração', () => {
    expect(parseCsv(serializarCsv(['d'], [['-almoço']])).linhas[0][0]).toBe("'-almoço")
  })

  it('NÃO toca em número bem-formado: a coluna de valor precisa continuar numérica', () => {
    // '-123,45' é valor, não subtração. Sem esta exceção o Excel leria a coluna
    // inteira como texto e a soma da planilha daria zero.
    // Header de duas colunas de proposito: o parseCsv deduz o delimitador da
    // primeira linha, e com uma coluna so ele nao acha ';' e cai no ',',
    // quebrando '1234,56' em dois campos. O export real tem oito colunas.
    const linhas = [
      ['a', '1234,56'],
      ['b', '0,00'],
      ['c', '-123,45'],
      ['d', '1234.56'],
      ['e', '0']
    ]
    expect(parseCsv(serializarCsv(['d', 'valor'], linhas)).linhas).toEqual(linhas)
  })

  it('não mexe em texto comum, nem quando o caractere aparece no meio', () => {
    const linhas = [['Almoço'], ['a=b'], ['Conta 1+1']]
    expect(parseCsv(serializarCsv(['d'], linhas)).linhas).toEqual(linhas)
  })

  it('protege também o header, que é genérico e pode não vir de constante', () => {
    expect(parseCsv(serializarCsv(['=cmd'], [['x']])).header[0]).toBe("'=cmd")
  })

  it('combina com a citação: campo perigoso COM delimitador sai citado e prefixado', () => {
    const csv = serializarCsv(['d'], [['=1;2']])
    expect(csv).toBe('d\n"\'=1;2"\n')
    expect(parseCsv(csv).linhas[0][0]).toBe("'=1;2")
  })

  it('o round-trip deixa de ser simétrico para valor neutralizado — é a troca aceita', () => {
    // Só acontece com valor que a planilha executaria, e nenhum fluxo do app
    // reimporta uma exportação de mês: o import usa `LinhaImportacao` tipada,
    // com outro conjunto de colunas.
    expect(parseCsv(serializarCsv(['d'], [['=1+1']])).linhas[0][0]).toBe("'=1+1")
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

  it('atravessa o serializarCsv sem virar texto', () => {
    const valores = [1, 99, 100, 12345, 999999901].map((c) => ['x', formatarValorCsv(c)])
    expect(parseCsv(serializarCsv(['d', 'valor'], valores)).linhas).toEqual(valores)
  })
})
