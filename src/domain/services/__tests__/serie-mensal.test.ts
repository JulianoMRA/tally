import { describe, expect, it } from 'vitest'
import { gerarSerieMensal } from '../serie-mensal'

describe('gerarSerieMensal', () => {
  it('gera 1 mes (so o mes final)', () => {
    expect(gerarSerieMensal('2026-06', 1)).toEqual(['2026-06'])
  })

  it('gera 6 meses retrocedendo a partir do mes final', () => {
    expect(gerarSerieMensal('2026-06', 6)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06'
    ])
  })

  it('gera 12 meses atravessando virada de ano', () => {
    const r = gerarSerieMensal('2026-06', 12)
    expect(r).toHaveLength(12)
    expect(r[0]).toBe('2025-07')
    expect(r[r.length - 1]).toBe('2026-06')
  })

  it('lanca erro quando quantidade <= 0', () => {
    expect(() => gerarSerieMensal('2026-06', 0)).toThrow()
    expect(() => gerarSerieMensal('2026-06', -1)).toThrow()
  })
})
