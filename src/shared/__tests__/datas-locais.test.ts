import { afterEach, describe, expect, it, vi } from 'vitest'
import { hojeIsoLocal, mesAtualReferencia } from '../datas-locais'

/**
 * O bug que motivou este módulo: `new Date().toISOString().slice(0, 10)` usa
 * UTC. Em UTC-3 (Brasil), a partir das 21h o "hoje" UTC já é amanhã — faturas
 * fechavam cedo e modais sugeriam a data errada. Aqui fixamos o relógio em
 * horários locais de borda e exigimos que a data devolvida seja a LOCAL.
 */
describe('hojeIsoLocal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('devolve a data local em YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 11, 12, 0, 0))
    expect(hojeIsoLocal()).toBe('2026-06-11')
  })

  it('às 23h30 locais do último dia do mês, ainda é o mesmo dia local', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 30, 23, 30, 0))
    expect(hojeIsoLocal()).toBe('2026-06-30')
  })

  it('faz padding de mês e dia com um dígito', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 8, 0, 0))
    expect(hojeIsoLocal()).toBe('2026-01-05')
  })
})

describe('mesAtualReferencia', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('devolve o mês local em YYYY-MM, consistente com hojeIsoLocal', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 0))
    expect(mesAtualReferencia()).toBe('2026-12')
    expect(mesAtualReferencia()).toBe(hojeIsoLocal().slice(0, 7))
  })
})
