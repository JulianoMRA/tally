import { describe, it, expect } from 'vitest'
import { classificarHorizonte, rotuloHorizonte } from '../horizonte'

describe('classificarHorizonte', () => {
  it('conta os dias restantes dentro do mês corrente', () => {
    expect(classificarHorizonte('2026-08', '2026-08-16')).toEqual({
      kind: 'Corrente',
      diasRestantes: 15
    })
  })

  it('no último dia do mês ainda é corrente, com zero dias pela frente', () => {
    expect(classificarHorizonte('2026-08', '2026-08-31')).toEqual({
      kind: 'Corrente',
      diasRestantes: 0
    })
  })

  it('mês já virado é encerrado, não corrente com zero dias', () => {
    expect(classificarHorizonte('2026-07', '2026-08-16')).toEqual({ kind: 'Encerrado' })
  })

  // Ao navegar para um mês futuro a agenda cobre o mês inteiro, não o intervalo
  // desde hoje — senão setembro visto em agosto anunciaria 45 dias.
  it('mês que ainda não começou vale o mês inteiro', () => {
    expect(classificarHorizonte('2026-09', '2026-08-16')).toEqual({
      kind: 'Futuro',
      diasNoMes: 30
    })
  })

  it('respeita meses de 31 e de 28 dias', () => {
    expect(classificarHorizonte('2026-01', '2026-01-01')).toEqual({
      kind: 'Corrente',
      diasRestantes: 30
    })
    expect(classificarHorizonte('2026-02', '2026-02-01')).toEqual({
      kind: 'Corrente',
      diasRestantes: 27
    })
  })

  it('respeita fevereiro de ano bissexto', () => {
    expect(classificarHorizonte('2028-02', '2028-02-01')).toEqual({
      kind: 'Corrente',
      diasRestantes: 28
    })
  })

  it('devolve Indefinido para formatos inesperados em vez de NaN', () => {
    expect(classificarHorizonte('abc', '2026-08-16')).toEqual({ kind: 'Indefinido' })
    expect(classificarHorizonte('2026-08', 'abc')).toEqual({ kind: 'Indefinido' })
    expect(classificarHorizonte('2026-13', '2026-08-16')).toEqual({ kind: 'Indefinido' })
  })
})

describe('rotuloHorizonte', () => {
  it('conta a partir de hoje quando o mês exibido é o corrente', () => {
    expect(rotuloHorizonte('2026-08', '2026-08-16')).toBe('próximos 15 dias')
  })

  it('pluraliza o dia', () => {
    expect(rotuloHorizonte('2026-08', '2026-08-30')).toBe('próximos 1 dia')
  })

  it('nomeia o último dia em vez de anunciar zero dias pela frente', () => {
    expect(rotuloHorizonte('2026-08', '2026-08-31')).toBe('último dia do mês')
  })

  // O defeito: em mês futuro o horizonte é o mês inteiro, e "próximos 31 dias"
  // lido a partir de hoje aponta para outro mês.
  it('não diz "próximos" para um mês que ainda não começou', () => {
    expect(rotuloHorizonte('2026-12', '2026-09-01')).toBe('os 31 dias do mês')
  })

  it('diz que o mês encerrou em vez de prometer zero dias', () => {
    expect(rotuloHorizonte('2026-07', '2026-08-16')).toBe('mês encerrado')
  })

  it('cala em vez de rotular errado quando a entrada não faz sentido', () => {
    expect(rotuloHorizonte('abc', '2026-08-16')).toBe('')
  })
})
