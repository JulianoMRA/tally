import { describe, it, expect } from 'vitest'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from '../calcular-fatura-da-compra'

describe('calcularReferenciaFaturaDaCompra (RN-01)', () => {
  describe('exemplos do PRD', () => {
    it('Inter (F=05): compra 03/06 entra na fatura de junho', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-03', 5)).toEqual({ ano: 2026, mes: 6 })
    })

    it('Inter (F=05): compra 07/06 entra na fatura de julho', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-07', 5)).toEqual({ ano: 2026, mes: 7 })
    })

    it('Nubank (F=15): compra 10/06 entra na fatura de junho', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-10', 15)).toEqual({ ano: 2026, mes: 6 })
    })

    it('Nubank (F=15): compra 20/06 entra na fatura de julho', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-20', 15)).toEqual({ ano: 2026, mes: 7 })
    })
  })

  describe('edge cases', () => {
    it('compra exatamente no dia do fechamento entra no mês seguinte (regra <)', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-05', 5)).toEqual({ ano: 2026, mes: 7 })
    })

    it('compra na véspera do fechamento entra no mesmo mês', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-04', 5)).toEqual({ ano: 2026, mes: 6 })
    })

    it('compra dia 1 com fechamento dia 1 entra no mês seguinte', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-01', 1)).toEqual({ ano: 2026, mes: 7 })
    })

    it('compra dia 2 com fechamento dia 1 entra no mês seguinte', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-06-02', 1)).toEqual({ ano: 2026, mes: 7 })
    })

    it('compra dia 31 com fechamento dia 31 entra no mês seguinte', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-07-31', 31)).toEqual({ ano: 2026, mes: 8 })
    })

    it('compra em dezembro depois do fechamento rola para janeiro do ano seguinte', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-12-20', 15)).toEqual({ ano: 2027, mes: 1 })
    })

    it('compra em dezembro no dia do fechamento rola para janeiro do ano seguinte', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-12-15', 15)).toEqual({ ano: 2027, mes: 1 })
    })

    it('compra em dezembro antes do fechamento permanece em dezembro', () => {
      expect(calcularReferenciaFaturaDaCompra('2026-12-14', 15)).toEqual({ ano: 2026, mes: 12 })
    })

    it('cartão F=31 com compra dia 28/02 entra em fevereiro (28 < 31)', () => {
      expect(calcularReferenciaFaturaDaCompra('2027-02-28', 31)).toEqual({ ano: 2027, mes: 2 })
    })
  })

  describe('validação de input', () => {
    it.each([
      ['data vazia', ''],
      ['data malformada', '2026/06/03'],
      ['mês inválido', '2026-13-01'],
      ['dia inválido', '2026-06-32'],
      ['ano inválido', 'abcd-06-03']
    ])('rejeita %s', (_label, value) => {
      expect(() => calcularReferenciaFaturaDaCompra(value, 5)).toThrow()
    })

    it.each([0, 32, -1, 1.5, NaN])('rejeita diaFechamento inválido (%s)', (dia) => {
      expect(() => calcularReferenciaFaturaDaCompra('2026-06-03', dia)).toThrow()
    })
  })
})

describe('formatarMesReferencia', () => {
  it('formata como YYYY-MM com zero à esquerda', () => {
    expect(formatarMesReferencia({ ano: 2026, mes: 6 })).toBe('2026-06')
    expect(formatarMesReferencia({ ano: 2026, mes: 12 })).toBe('2026-12')
    expect(formatarMesReferencia({ ano: 2027, mes: 1 })).toBe('2027-01')
  })
})
