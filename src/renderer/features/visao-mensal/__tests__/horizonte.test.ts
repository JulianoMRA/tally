import { describe, it, expect } from 'vitest'
import { diasAteFimDoMes } from '../horizonte'

describe('diasAteFimDoMes', () => {
  it('conta os dias restantes dentro do mês corrente', () => {
    expect(diasAteFimDoMes('2026-08', '2026-08-16')).toBe(15)
  })

  it('devolve 0 no último dia do mês', () => {
    expect(diasAteFimDoMes('2026-08', '2026-08-31')).toBe(0)
  })

  it('devolve 0 para mês já encerrado', () => {
    expect(diasAteFimDoMes('2026-07', '2026-08-16')).toBe(0)
  })

  // Ao navegar para um mês futuro a agenda cobre o mês inteiro, não o intervalo
  // desde hoje — senão setembro visto em agosto anunciaria 45 dias.
  it('devolve o mês inteiro quando o mês exibido ainda não começou', () => {
    expect(diasAteFimDoMes('2026-09', '2026-08-16')).toBe(30)
  })

  it('respeita meses de 31 e de 28 dias', () => {
    expect(diasAteFimDoMes('2026-01', '2026-01-01')).toBe(30)
    expect(diasAteFimDoMes('2026-02', '2026-02-01')).toBe(27)
  })

  it('respeita fevereiro de ano bissexto', () => {
    expect(diasAteFimDoMes('2028-02', '2028-02-01')).toBe(28)
  })

  it('devolve 0 para formatos inesperados em vez de NaN', () => {
    expect(diasAteFimDoMes('abc', '2026-08-16')).toBe(0)
    expect(diasAteFimDoMes('2026-08', 'abc')).toBe(0)
    expect(diasAteFimDoMes('2026-13', '2026-08-16')).toBe(0)
  })
})
