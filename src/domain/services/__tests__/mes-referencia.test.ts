import { describe, expect, it } from 'vitest'
import {
  clampDiaNoMes,
  diasNoMes,
  diferencaEmDias,
  diferencaEmMeses,
  mesReferenciaAnterior,
  proxMesReferencia,
  somarDias
} from '../mes-referencia'

describe('diferencaEmDias', () => {
  it('conta dias dentro do mesmo mes (b - a)', () => {
    expect(diferencaEmDias('2026-07-10', '2026-07-15')).toBe(5)
    expect(diferencaEmDias('2026-07-15', '2026-07-10')).toBe(-5)
    expect(diferencaEmDias('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('cruza virada de mes e de ano', () => {
    expect(diferencaEmDias('2026-07-31', '2026-08-01')).toBe(1)
    expect(diferencaEmDias('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('conta fevereiro bissexto corretamente', () => {
    expect(diferencaEmDias('2024-02-28', '2024-03-01')).toBe(2)
    expect(diferencaEmDias('2026-02-28', '2026-03-01')).toBe(1)
  })
})

describe('somarDias', () => {
  it('soma dias dentro do mesmo mes', () => {
    expect(somarDias('2026-07-10', 5)).toBe('2026-07-15')
    expect(somarDias('2026-07-10', 0)).toBe('2026-07-10')
  })

  it('cruza virada de mes e de ano', () => {
    expect(somarDias('2026-07-30', 3)).toBe('2026-08-02')
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('respeita fevereiro bissexto', () => {
    expect(somarDias('2024-02-28', 2)).toBe('2024-03-01')
    expect(somarDias('2026-02-28', 2)).toBe('2026-03-02')
  })
})

describe('proxMesReferencia', () => {
  it('avanca mes dentro do mesmo ano', () => {
    expect(proxMesReferencia('2026-05')).toBe('2026-06')
  })
  it('vira o ano em dezembro', () => {
    expect(proxMesReferencia('2026-12')).toBe('2027-01')
  })
})

describe('mesReferenciaAnterior', () => {
  it('retrocede mes dentro do mesmo ano', () => {
    expect(mesReferenciaAnterior('2026-06')).toBe('2026-05')
  })
  it('vira o ano em janeiro', () => {
    expect(mesReferenciaAnterior('2026-01')).toBe('2025-12')
  })
})

describe('diasNoMes', () => {
  it('retorna 31 para meses de 31 dias', () => {
    expect(diasNoMes(2026, 1)).toBe(31)
    expect(diasNoMes(2026, 12)).toBe(31)
  })
  it('retorna 30 para meses de 30 dias', () => {
    expect(diasNoMes(2026, 4)).toBe(30)
    expect(diasNoMes(2026, 11)).toBe(30)
  })
  it('retorna 28 ou 29 para fevereiro conforme bissexto', () => {
    expect(diasNoMes(2026, 2)).toBe(28)
    expect(diasNoMes(2024, 2)).toBe(29)
    expect(diasNoMes(2100, 2)).toBe(28)
    expect(diasNoMes(2000, 2)).toBe(29)
  })
})

describe('clampDiaNoMes', () => {
  it('mantem o dia quando ele cabe no mes', () => {
    expect(clampDiaNoMes(2026, 5, 15)).toBe('2026-05-15')
  })
  it('limita dia 31 em fevereiro', () => {
    expect(clampDiaNoMes(2026, 2, 31)).toBe('2026-02-28')
    expect(clampDiaNoMes(2024, 2, 31)).toBe('2024-02-29')
  })
  it('limita dia 31 em abril', () => {
    expect(clampDiaNoMes(2026, 4, 31)).toBe('2026-04-30')
  })
})

describe('diferencaEmMeses', () => {
  it('retorna 0 quando os meses sao iguais', () => {
    expect(diferencaEmMeses('2026-05', '2026-05')).toBe(0)
  })
  it('retorna positivo quando b e futuro de a', () => {
    expect(diferencaEmMeses('2026-05', '2026-08')).toBe(3)
  })
  it('retorna negativo quando b e passado de a', () => {
    expect(diferencaEmMeses('2026-08', '2026-05')).toBe(-3)
  })
  it('atravessa virada de ano corretamente', () => {
    expect(diferencaEmMeses('2026-11', '2027-02')).toBe(3)
    expect(diferencaEmMeses('2025-12', '2026-01')).toBe(1)
  })
  it('lida com diferencas grandes', () => {
    expect(diferencaEmMeses('2026-01', '2028-01')).toBe(24)
    expect(diferencaEmMeses('2020-06', '2026-05')).toBe(71)
  })
})
