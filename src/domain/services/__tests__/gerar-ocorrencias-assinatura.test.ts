import { describe, it, expect } from 'vitest'
import { gerarOcorrenciasAssinatura } from '../gerar-ocorrencias-assinatura'
import type { Cartao } from '../../entities/cartao'

function cartao(diaFechamento: number): Cartao {
  return {
    id: 1,
    nome: 'Teste',
    diaFechamento,
    diaVencimento: diaFechamento + 7,
    cor: '#000',
    ativo: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
}

describe('gerarOcorrenciasAssinatura (RN-04)', () => {
  describe('quantidade e numeração', () => {
    it('gera exatamente N ocorrências em meses consecutivos', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-10',
        valorMensalCentavos: 2190,
        quantidade: 12
      })

      expect(ocorrencias).toHaveLength(12)
      expect(ocorrencias.map((o) => o.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    })

    it('total é sempre null (assinatura sem fim)', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-10',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      for (const o of ocorrencias) {
        expect(o.total).toBeNull()
      }
    })

    it('valor mensal é replicado em cada ocorrência (sem distribuição)', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-10',
        valorMensalCentavos: 2190,
        quantidade: 6
      })

      for (const o of ocorrencias) {
        expect(o.valorCentavos).toBe(2190)
      }
    })
  })

  describe('RN-01 aplicada à primeira ocorrência', () => {
    it('data antes do fechamento → primeira no mês corrente', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-10',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual(['2026-05', '2026-06', '2026-07'])
    })

    it('data depois do fechamento → primeira no mês seguinte', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-20',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual(['2026-06', '2026-07', '2026-08'])
    })

    it('data exatamente no dia de fechamento entra no mês corrente', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-15',
        valorMensalCentavos: 1000,
        quantidade: 2
      })

      expect(ocorrencias[0].dataReferencia).toBe('2026-05')
      expect(ocorrencias[1].dataReferencia).toBe('2026-06')
    })
  })

  describe('virada de mês e de ano', () => {
    it('12 ocorrências a partir de novembro cruzam para outubro do ano seguinte', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-11-10',
        valorMensalCentavos: 1000,
        quantidade: 12
      })

      const refs = ocorrencias.map((o) => o.dataReferencia)
      expect(refs[0]).toBe('2026-11')
      expect(refs[1]).toBe('2026-12')
      expect(refs[2]).toBe('2027-01')
      expect(refs[11]).toBe('2027-10')
    })

    it('compra em dezembro depois do fechamento começa em janeiro do ano seguinte', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(5),
        dataInicio: '2026-12-20',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual(['2027-01', '2027-02', '2027-03'])
    })
  })

  describe('ocorrenciaInicial para extensão preguiçosa (Slice 12)', () => {
    it('numera a partir de ocorrenciaInicial, mantendo o salto temporal', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2027-05-10',
        valorMensalCentavos: 1000,
        ocorrenciaInicial: 13,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.numero)).toEqual([13, 14, 15])
      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual(['2027-05', '2027-06', '2027-07'])
    })
  })

  describe('validações', () => {
    it('quantidade <= 0 lança erro', () => {
      expect(() =>
        gerarOcorrenciasAssinatura({
          cartao: cartao(15),
          dataInicio: '2026-05-10',
          valorMensalCentavos: 1000,
          quantidade: 0
        })
      ).toThrow(/quantidade/)
    })

    it('quantidade não inteira lança erro', () => {
      expect(() =>
        gerarOcorrenciasAssinatura({
          cartao: cartao(15),
          dataInicio: '2026-05-10',
          valorMensalCentavos: 1000,
          quantidade: 1.5
        })
      ).toThrow(/quantidade/)
    })

    it('valorMensalCentavos <= 0 lança erro', () => {
      expect(() =>
        gerarOcorrenciasAssinatura({
          cartao: cartao(15),
          dataInicio: '2026-05-10',
          valorMensalCentavos: 0,
          quantidade: 12
        })
      ).toThrow(/valor/i)
    })

    it('ocorrenciaInicial < 1 lança erro', () => {
      expect(() =>
        gerarOcorrenciasAssinatura({
          cartao: cartao(15),
          dataInicio: '2026-05-10',
          valorMensalCentavos: 1000,
          ocorrenciaInicial: 0,
          quantidade: 12
        })
      ).toThrow(/ocorrenciaInicial/)
    })
  })
})
