import { describe, it, expect } from 'vitest'
import { dataIsoSchema } from '../date-schema'

describe('dataIsoSchema', () => {
  it('aceita data válida', () => {
    expect(() => dataIsoSchema.parse('2026-06-07')).not.toThrow()
  })

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(() => dataIsoSchema.parse('2024-02-29')).not.toThrow()
  })

  it('aceita os extremos do mês (01 e 31)', () => {
    expect(() => dataIsoSchema.parse('2026-01-01')).not.toThrow()
    expect(() => dataIsoSchema.parse('2026-01-31')).not.toThrow()
  })

  it('rejeita formato fora de YYYY-MM-DD', () => {
    expect(() => dataIsoSchema.parse('07/06/2026')).toThrow()
    expect(() => dataIsoSchema.parse('2026-6-7')).toThrow()
    expect(() => dataIsoSchema.parse('2026-06')).toThrow()
  })

  it('rejeita 30 de fevereiro (data de calendário impossível)', () => {
    expect(() => dataIsoSchema.parse('2026-02-30')).toThrow()
  })

  it('rejeita 29 de fevereiro em ano não bissexto', () => {
    expect(() => dataIsoSchema.parse('2026-02-29')).toThrow()
  })

  it('rejeita 31 de abril (mês de 30 dias)', () => {
    expect(() => dataIsoSchema.parse('2026-04-31')).toThrow()
  })

  it('rejeita mês 00 e mês 13', () => {
    expect(() => dataIsoSchema.parse('2026-00-10')).toThrow()
    expect(() => dataIsoSchema.parse('2026-13-10')).toThrow()
  })

  it('rejeita dia 00', () => {
    expect(() => dataIsoSchema.parse('2026-06-00')).toThrow()
  })

  it('rejeita valor não-string', () => {
    expect(() => dataIsoSchema.parse(20260607)).toThrow()
  })
})
