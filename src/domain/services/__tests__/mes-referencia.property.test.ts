import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  proxMesReferencia,
  mesReferenciaAnterior,
  diferencaEmMeses,
  clampDiaNoMes,
  diasNoMes
} from '../mes-referencia'

const mesRefArb = fc
  .tuple(fc.integer({ min: 2000, max: 2100 }), fc.integer({ min: 1, max: 12 }))
  .map(([ano, mes]) => `${ano}-${String(mes).padStart(2, '0')}`)

describe('mes-referencia (propriedades)', () => {
  it('anterior e proximo sao inversos', () => {
    fc.assert(
      fc.property(mesRefArb, (m) => {
        expect(mesReferenciaAnterior(proxMesReferencia(m))).toBe(m)
        expect(proxMesReferencia(mesReferenciaAnterior(m))).toBe(m)
      })
    )
  })

  it('diferencaEmMeses conta exatamente N avancos de mes', () => {
    fc.assert(
      fc.property(mesRefArb, fc.integer({ min: 0, max: 240 }), (m, n) => {
        let alvo = m
        for (let i = 0; i < n; i++) alvo = proxMesReferencia(alvo)
        expect(diferencaEmMeses(m, alvo)).toBe(n)
      })
    )
  })

  it('clampDiaNoMes sempre produz uma data de calendario valida', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (ano, mes, dia) => {
          const data = clampDiaNoMes(ano, mes, dia)
          expect(data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          const diaResultante = Number(data.slice(8, 10))
          expect(diaResultante).toBeLessThanOrEqual(diasNoMes(ano, mes))
          expect(diaResultante).toBe(Math.min(dia, diasNoMes(ano, mes)))
        }
      )
    )
  })
})
