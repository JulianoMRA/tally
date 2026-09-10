import { describe, it, expect } from 'vitest'
import { periodoPadrao, recuarMeses, validarPeriodo, type PeriodoBusca } from '../periodo-busca'

describe('recuarMeses', () => {
  it('recua dentro do mesmo ano', () => {
    expect(recuarMeses('2026-09', 3)).toBe('2026-06')
  })

  // A virada de ano é onde a aritmética de mês costuma quebrar.
  it('atravessa a virada de ano', () => {
    expect(recuarMeses('2026-02', 3)).toBe('2025-11')
  })

  it('recua exatamente até janeiro sem passar para o ano anterior', () => {
    expect(recuarMeses('2026-09', 8)).toBe('2026-01')
  })

  it('recua um ano inteiro', () => {
    expect(recuarMeses('2026-09', 12)).toBe('2025-09')
  })

  it('recua vários anos', () => {
    expect(recuarMeses('2026-01', 25)).toBe('2023-12')
  })

  it('zero devolve o próprio mês', () => {
    expect(recuarMeses('2026-09', 0)).toBe('2026-09')
  })

  it('recusa mês fora do formato', () => {
    expect(() => recuarMeses('2026-13', 1)).toThrow(/inválido/i)
    expect(() => recuarMeses('setembro', 1)).toThrow(/inválido/i)
  })
})

describe('periodoPadrao', () => {
  /**
   * Doze meses CONTANDO o corrente — não treze. Recuar 12 daria um intervalo
   * de 13 meses, que é o erro clássico de intervalo fechado.
   */
  it('abre nos últimos 12 meses, incluindo o corrente', () => {
    expect(periodoPadrao('2026-09')).toEqual({ mesInicio: '2025-10', mesFim: '2026-09' })
  })

  it('o intervalo padrão tem exatamente 12 meses', () => {
    const { mesInicio, mesFim } = periodoPadrao('2026-09')
    const [ai, mi] = mesInicio.split('-').map(Number)
    const [af, mf] = mesFim.split('-').map(Number)
    expect((af - ai) * 12 + (mf - mi) + 1).toBe(12)
  })
})

describe('validarPeriodo', () => {
  const p = (mesInicio: string, mesFim: string): PeriodoBusca => ({ mesInicio, mesFim })

  it('aceita intervalo normal', () => {
    expect(validarPeriodo(p('2026-01', '2026-09'))).toBeNull()
  })

  it('aceita intervalo de um mês só', () => {
    expect(validarPeriodo(p('2026-09', '2026-09'))).toBeNull()
  })

  it('recusa intervalo invertido', () => {
    expect(validarPeriodo(p('2026-09', '2026-01'))).toBe('invertido')
  })

  it('recusa mês fora do formato', () => {
    expect(validarPeriodo(p('2026-00', '2026-09'))).toBe('mes-invalido')
    expect(validarPeriodo(p('2026-01', '2026-13'))).toBe('mes-invalido')
  })

  // O teto protege a peneira em memória: sem ele, um engano de digitação no
  // ano ('0026-01') viraria uma varredura do banco inteiro.
  it('aceita exatamente 120 meses e recusa 121', () => {
    expect(validarPeriodo(p('2017-01', '2026-12'))).toBeNull()
    expect(validarPeriodo(p('2016-12', '2026-12'))).toBe('longo-demais')
  })

  it('acusa a inversão antes do tamanho, quando os dois valem', () => {
    expect(validarPeriodo(p('2026-12', '1990-01'))).toBe('invertido')
  })
})
