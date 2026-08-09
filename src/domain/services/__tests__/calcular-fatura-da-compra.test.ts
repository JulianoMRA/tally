import { describe, it, expect } from 'vitest'
import {
  calcularDatasDaFatura,
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

describe('calcularDatasDaFatura', () => {
  describe('vencimento no mesmo mês do fechamento (V > F)', () => {
    it('Inter (F=05, V=12): fatura de junho fecha 05/06 e vence 12/06', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 6 }, 5, 12)).toEqual({
        dataFechamento: '2026-06-05',
        dataVencimento: '2026-06-12'
      })
    })

    it('Nubank (F=15, V=22): fatura de junho fecha 15/06 e vence 22/06', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 6 }, 15, 22)).toEqual({
        dataFechamento: '2026-06-15',
        dataVencimento: '2026-06-22'
      })
    })

    it('V igual a F mantém as duas datas no mesmo dia', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 6 }, 10, 10)).toEqual({
        dataFechamento: '2026-06-10',
        dataVencimento: '2026-06-10'
      })
    })
  })

  describe('vencimento no mês seguinte ao fechamento (V < F)', () => {
    it('cartão que fecha 24 e vence 01: fatura de agosto fecha 24/08 e vence 01/09', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 8 }, 24, 1)).toEqual({
        dataFechamento: '2026-08-24',
        dataVencimento: '2026-09-01'
      })
    })

    it('vencimento nunca é anterior ao fechamento', () => {
      const { dataFechamento, dataVencimento } = calcularDatasDaFatura({ ano: 2026, mes: 8 }, 24, 1)
      expect(dataVencimento > dataFechamento).toBe(true)
    })

    it('fatura de dezembro vence em janeiro do ano seguinte', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 12 }, 24, 1)).toEqual({
        dataFechamento: '2026-12-24',
        dataVencimento: '2027-01-01'
      })
    })
  })

  describe('clamp de dias que não existem no mês', () => {
    it('F=31 em fevereiro fecha no último dia do mês', () => {
      expect(calcularDatasDaFatura({ ano: 2027, mes: 2 }, 31, 5)).toEqual({
        dataFechamento: '2027-02-28',
        dataVencimento: '2027-03-05'
      })
    })

    it('V=31 no mesmo mês cai no último dia disponível', () => {
      expect(calcularDatasDaFatura({ ano: 2026, mes: 8 }, 24, 31)).toEqual({
        dataFechamento: '2026-08-24',
        dataVencimento: '2026-08-31'
      })
    })

    it('V=30 rolando para fevereiro é clamped ao último dia de fevereiro', () => {
      expect(calcularDatasDaFatura({ ano: 2027, mes: 1 }, 31, 30)).toEqual({
        dataFechamento: '2027-01-31',
        dataVencimento: '2027-02-28'
      })
    })
  })

  describe('validação de input', () => {
    it.each([0, 32, -1, 1.5, NaN])('rejeita diaFechamento inválido (%s)', (dia) => {
      expect(() => calcularDatasDaFatura({ ano: 2026, mes: 6 }, dia, 12)).toThrow()
    })

    it.each([0, 32, -1, 1.5, NaN])('rejeita diaVencimento inválido (%s)', (dia) => {
      expect(() => calcularDatasDaFatura({ ano: 2026, mes: 6 }, 5, dia)).toThrow()
    })
  })
})
