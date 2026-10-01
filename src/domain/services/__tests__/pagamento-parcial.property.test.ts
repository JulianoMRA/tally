import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { calcularRestanteDaFatura, podeRegistrarPagamentoParcial } from '../pagamento-parcial'

const centavos = fc.integer({ min: 0, max: 1_000_000_000 })

describe('calcularRestanteDaFatura (propriedades)', () => {
  // A conta inteira em uma linha: o que falta menos o que sobrou é sempre o
  // total menos o pago, e nunca os dois lados ao mesmo tempo.
  it('falta pagar e pago a mais nunca são negativos, e só um deles é maior que zero', () => {
    fc.assert(
      fc.property(centavos, centavos, (total, pago) => {
        const { restanteCentavos, excedenteCentavos } = calcularRestanteDaFatura(total, pago)

        expect(restanteCentavos).toBeGreaterThanOrEqual(0)
        expect(excedenteCentavos).toBeGreaterThanOrEqual(0)
        expect(Math.min(restanteCentavos, excedenteCentavos)).toBe(0)
        expect(restanteCentavos - excedenteCentavos).toBe(total - pago)
      })
    )
  })

  it('devolve o total e o pago que recebeu, sem arredondar', () => {
    fc.assert(
      fc.property(centavos, centavos, (total, pago) => {
        const saldo = calcularRestanteDaFatura(total, pago)

        expect(saldo.totalCentavos).toBe(total)
        expect(saldo.pagoParcialCentavos).toBe(pago)
      })
    )
  })
})

describe('podeRegistrarPagamentoParcial (propriedades)', () => {
  // O invariante que a tela e o banco dependem: depois de um pagamento aceito,
  // o pago nunca passa do total. Fatura Aberta aceita até o restante inteiro.
  it('em fatura Aberta, aceita exatamente os valores de 1 centavo até o que falta', () => {
    fc.assert(
      fc.property(centavos, fc.integer({ min: 1, max: 1_000_000_000 }), (restante, valor) => {
        const resultado = podeRegistrarPagamentoParcial({
          statusFatura: 'Aberta',
          restanteCentavos: restante,
          valorCentavos: valor,
          dataPagamento: '2026-10-10'
        })

        expect(resultado.ok).toBe(valor <= restante)
      })
    )
  })

  it('em fatura Fechada, aceita exatamente os valores abaixo do que falta', () => {
    fc.assert(
      fc.property(centavos, fc.integer({ min: 1, max: 1_000_000_000 }), (restante, valor) => {
        const resultado = podeRegistrarPagamentoParcial({
          statusFatura: 'Fechada',
          restanteCentavos: restante,
          valorCentavos: valor,
          dataPagamento: '2026-10-10'
        })

        expect(resultado.ok).toBe(valor < restante)
      })
    )
  })
})
