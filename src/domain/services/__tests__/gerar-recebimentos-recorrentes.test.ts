import { describe, it, expect } from 'vitest'
import { gerarRecebimentosRecorrentes } from '../gerar-recebimentos-recorrentes'

describe('gerarRecebimentosRecorrentes (RF-REN-02)', () => {
  describe('quantidade e numeração das datas', () => {
    it('gera N ocorrências em meses consecutivos', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-06-01',
        valorPadraoCentavos: 120000,
        diaEsperado: 5,
        quantidade: 12
      })

      expect(ocorrencias).toHaveLength(12)
    })

    it('valor é replicado em cada ocorrência', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-06-01',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        quantidade: 3
      })

      for (const o of ocorrencias) {
        expect(o.valorCentavos).toBe(100000)
      }
    })
  })

  describe('cálculo da primeira data', () => {
    it('quando dataInicio é antes do diaEsperado do mês: primeira no mês corrente', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-06-01',
        valorPadraoCentavos: 1000,
        diaEsperado: 10,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual([
        '2026-06-10',
        '2026-07-10',
        '2026-08-10'
      ])
    })

    it('quando dataInicio cai exatamente no diaEsperado: primeira no mês corrente', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-06-10',
        valorPadraoCentavos: 1000,
        diaEsperado: 10,
        quantidade: 2
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual(['2026-06-10', '2026-07-10'])
    })

    it('quando dataInicio é depois do diaEsperado do mês: primeira no mês seguinte', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-03-10',
        valorPadraoCentavos: 1000,
        diaEsperado: 5,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual([
        '2026-04-05',
        '2026-05-05',
        '2026-06-05'
      ])
    })
  })

  describe('clamp do dia ao último dia do mês', () => {
    it('diaEsperado=31 em fevereiro (não bissexto) cai no dia 28', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-01-15',
        valorPadraoCentavos: 1000,
        diaEsperado: 31,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31'
      ])
    })

    it('diaEsperado=31 em fevereiro de ano bissexto cai no dia 29', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2028-01-15',
        valorPadraoCentavos: 1000,
        diaEsperado: 31,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual([
        '2028-01-31',
        '2028-02-29',
        '2028-03-31'
      ])
    })

    it('diaEsperado=31 em abril cai no dia 30', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-04-01',
        valorPadraoCentavos: 1000,
        diaEsperado: 31,
        quantidade: 2
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual(['2026-04-30', '2026-05-31'])
    })
  })

  describe('virada de ano', () => {
    it('12 meses a partir de novembro cruzam para outubro do ano seguinte', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2026-11-01',
        valorPadraoCentavos: 1000,
        diaEsperado: 5,
        quantidade: 12
      })

      const datas = ocorrencias.map((o) => o.dataEsperada)
      expect(datas[0]).toBe('2026-11-05')
      expect(datas[1]).toBe('2026-12-05')
      expect(datas[2]).toBe('2027-01-05')
      expect(datas[11]).toBe('2027-10-05')
    })
  })

  describe('ocorrenciaInicial para extensão preguiçosa (Slice 12)', () => {
    it('aceita ocorrenciaInicial > 1 e não muda comportamento de datas', () => {
      const ocorrencias = gerarRecebimentosRecorrentes({
        dataInicio: '2027-06-01',
        valorPadraoCentavos: 1000,
        diaEsperado: 5,
        ocorrenciaInicial: 13,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataEsperada)).toEqual([
        '2027-06-05',
        '2027-07-05',
        '2027-08-05'
      ])
    })
  })

  describe('validações', () => {
    it('quantidade <= 0 lança erro', () => {
      expect(() =>
        gerarRecebimentosRecorrentes({
          dataInicio: '2026-06-01',
          valorPadraoCentavos: 1000,
          diaEsperado: 5,
          quantidade: 0
        })
      ).toThrow(/quantidade/)
    })

    it('valor <= 0 lança erro', () => {
      expect(() =>
        gerarRecebimentosRecorrentes({
          dataInicio: '2026-06-01',
          valorPadraoCentavos: 0,
          diaEsperado: 5,
          quantidade: 12
        })
      ).toThrow(/valor/i)
    })

    it('diaEsperado fora de [1, 31] lança erro', () => {
      expect(() =>
        gerarRecebimentosRecorrentes({
          dataInicio: '2026-06-01',
          valorPadraoCentavos: 1000,
          diaEsperado: 0,
          quantidade: 12
        })
      ).toThrow(/diaEsperado/)

      expect(() =>
        gerarRecebimentosRecorrentes({
          dataInicio: '2026-06-01',
          valorPadraoCentavos: 1000,
          diaEsperado: 32,
          quantidade: 12
        })
      ).toThrow(/diaEsperado/)
    })
  })
})
