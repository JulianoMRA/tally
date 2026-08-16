import { describe, expect, it } from 'vitest'
import {
  formatarDataIso,
  formatarDiaMes,
  formatarDiaMesAbreviado,
  formatarMesReferencia
} from '../formatar-data'

// A implementação NÃO deve usar new Date('YYYY-MM-DD'): o parse é UTC e em
// fusos negativos (UTC-3) a data exibida voltaria um dia. Split de string.

describe('formatarDataIso', () => {
  it('converte ISO para DD/MM/AAAA preservando zeros à esquerda', () => {
    expect(formatarDataIso('2026-01-05')).toBe('05/01/2026')
    expect(formatarDataIso('2026-06-12')).toBe('12/06/2026')
  })

  it('formata corretamente a virada de ano', () => {
    expect(formatarDataIso('2026-12-31')).toBe('31/12/2026')
    expect(formatarDataIso('2027-01-01')).toBe('01/01/2027')
  })

  it('devolve travessão para valores ausentes', () => {
    expect(formatarDataIso(null)).toBe('—')
    expect(formatarDataIso(undefined)).toBe('—')
    expect(formatarDataIso('')).toBe('—')
  })

  it('devolve a string original quando o formato não é ISO completo', () => {
    expect(formatarDataIso('abc')).toBe('abc')
    expect(formatarDataIso('2026-6-3')).toBe('2026-6-3')
    expect(formatarDataIso('2026-06')).toBe('2026-06')
  })
})

describe('formatarMesReferencia', () => {
  it('converte YYYY-MM em mês por extenso', () => {
    expect(formatarMesReferencia('2026-06')).toBe('junho de 2026')
    expect(formatarMesReferencia('2026-01')).toBe('janeiro de 2026')
    expect(formatarMesReferencia('2026-12')).toBe('dezembro de 2026')
  })

  it('capitaliza a primeira letra quando solicitado', () => {
    expect(formatarMesReferencia('2026-06', { capitalizar: true })).toBe('Junho de 2026')
  })

  it('tolera data completa YYYY-MM-DD usando apenas ano e mês', () => {
    // O banner da DespesasPage recebe dataReferencia 'YYYY-MM-01' nos fluxos
    // de parcelada, assinatura e gasto fora do cartão.
    expect(formatarMesReferencia('2026-07-01')).toBe('julho de 2026')
  })

  it('devolve travessão para valores ausentes', () => {
    expect(formatarMesReferencia(null)).toBe('—')
    expect(formatarMesReferencia(undefined)).toBe('—')
    expect(formatarMesReferencia('')).toBe('—')
  })

  it('devolve a string original quando o formato é inválido', () => {
    expect(formatarMesReferencia('abc')).toBe('abc')
    expect(formatarMesReferencia('2026-13')).toBe('2026-13')
    expect(formatarMesReferencia('2026-00')).toBe('2026-00')
  })
})

describe('formatarDiaMes', () => {
  it('converte ISO para DD/MM preservando zeros à esquerda', () => {
    expect(formatarDiaMes('2026-06-12')).toBe('12/06')
    expect(formatarDiaMes('2026-01-05')).toBe('05/01')
  })

  it('devolve travessão para valores ausentes', () => {
    expect(formatarDiaMes(null)).toBe('—')
    expect(formatarDiaMes(undefined)).toBe('—')
    expect(formatarDiaMes('')).toBe('—')
  })

  it('devolve a string original quando o formato não é ISO completo', () => {
    expect(formatarDiaMes('abc')).toBe('abc')
    expect(formatarDiaMes('2026-06')).toBe('2026-06')
  })
})

describe('formatarDiaMesAbreviado', () => {
  it('converte ISO para DD mmm com o mês em três letras', () => {
    expect(formatarDiaMesAbreviado('2026-08-20')).toBe('20 ago')
    expect(formatarDiaMesAbreviado('2026-01-05')).toBe('05 jan')
  })

  it('abrevia março sem perder a cedilha', () => {
    expect(formatarDiaMesAbreviado('2026-03-14')).toBe('14 mar')
  })

  it('preserva o zero à esquerda do dia', () => {
    expect(formatarDiaMesAbreviado('2026-12-01')).toBe('01 dez')
  })

  it('devolve travessão para valores ausentes', () => {
    expect(formatarDiaMesAbreviado(null)).toBe('—')
    expect(formatarDiaMesAbreviado(undefined)).toBe('—')
    expect(formatarDiaMesAbreviado('')).toBe('—')
  })

  it('devolve a string original quando o formato não é ISO completo', () => {
    expect(formatarDiaMesAbreviado('abc')).toBe('abc')
    expect(formatarDiaMesAbreviado('2026-06')).toBe('2026-06')
  })

  it('devolve a string original quando o mês não existe', () => {
    expect(formatarDiaMesAbreviado('2026-13-01')).toBe('2026-13-01')
  })
})
