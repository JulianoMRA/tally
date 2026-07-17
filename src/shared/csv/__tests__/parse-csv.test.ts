import { describe, it, expect } from 'vitest'
import { parseCsv } from '../parse-csv'

describe('parseCsv (RFC 4180, delimitador ; com fallback ,)', () => {
  it('parseia CSV simples com ponto-e-virgula', () => {
    const r = parseCsv('a;b;c\n1;2;3\n4;5;6')
    expect(r.delimitador).toBe(';')
    expect(r.header).toEqual(['a', 'b', 'c'])
    expect(r.linhas).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6']
    ])
  })

  it('detecta virgula como delimitador quando nao ha ponto-e-virgula', () => {
    const r = parseCsv('a,b\n1,2')
    expect(r.delimitador).toBe(',')
    expect(r.linhas).toEqual([['1', '2']])
  })

  it('prefere ponto-e-virgula quando ambos aparecem no header', () => {
    // Header pt-BR tipico: valores usam virgula decimal, campos usam ;
    const r = parseCsv('descricao;valor\nAlmoço, no centro;12,34')
    expect(r.delimitador).toBe(';')
    expect(r.linhas).toEqual([['Almoço, no centro', '12,34']])
  })

  it('campo entre aspas preserva delimitador e quebra de linha internos', () => {
    const r = parseCsv('a;b\n"x;y";"linha1\nlinha2"')
    expect(r.linhas).toEqual([['x;y', 'linha1\nlinha2']])
  })

  it('aspas duplas escapadas ("") viram aspas literais', () => {
    const r = parseCsv('a\n"disse ""oi"" ontem"')
    expect(r.linhas).toEqual([['disse "oi" ontem']])
  })

  it('aceita CRLF e BOM UTF-8', () => {
    const r = parseCsv('﻿a;b\r\n1;2\r\n')
    expect(r.header).toEqual(['a', 'b'])
    expect(r.linhas).toEqual([['1', '2']])
  })

  it('ignora linhas vazias no fim e no meio', () => {
    const r = parseCsv('a;b\n1;2\n\n3;4\n\n')
    expect(r.linhas).toEqual([
      ['1', '2'],
      ['3', '4']
    ])
  })

  it('remove espacos ao redor de campos nao-citados', () => {
    const r = parseCsv('a;b\n 1 ; 2 ')
    expect(r.linhas).toEqual([['1', '2']])
  })

  it('lanca erro com numero da linha quando a contagem de campos difere do header', () => {
    expect(() => parseCsv('a;b\n1;2;3')).toThrow(/linha 2/i)
  })

  it('lanca erro para aspas nao terminadas', () => {
    expect(() => parseCsv('a\n"aberto sem fim')).toThrow(/aspas/i)
  })

  it('lanca erro para conteudo vazio ou apenas header', () => {
    expect(() => parseCsv('')).toThrow(/vazio/i)
    expect(() => parseCsv('a;b\n')).toThrow(/nenhuma linha/i)
  })
})
