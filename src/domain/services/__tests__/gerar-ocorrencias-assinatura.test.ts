import { describe, it, expect } from 'vitest'
import {
  gerarOcorrenciasAPartirDoMes,
  gerarOcorrenciasAssinatura
} from '../gerar-ocorrencias-assinatura'
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

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
        '2026-05-01',
        '2026-06-01',
        '2026-07-01'
      ])
    })

    it('data depois do fechamento → primeira no mês seguinte', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-20',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
        '2026-06-01',
        '2026-07-01',
        '2026-08-01'
      ])
    })

    it('data exatamente no dia de fechamento entra no mês seguinte (regra <)', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(15),
        dataInicio: '2026-05-15',
        valorMensalCentavos: 1000,
        quantidade: 2
      })

      expect(ocorrencias[0].dataReferencia).toBe('2026-06-01')
      expect(ocorrencias[1].dataReferencia).toBe('2026-07-01')
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
      expect(refs[0]).toBe('2026-11-01')
      expect(refs[1]).toBe('2026-12-01')
      expect(refs[2]).toBe('2027-01-01')
      expect(refs[11]).toBe('2027-10-01')
    })

    it('compra em dezembro depois do fechamento começa em janeiro do ano seguinte', () => {
      const ocorrencias = gerarOcorrenciasAssinatura({
        cartao: cartao(5),
        dataInicio: '2026-12-20',
        valorMensalCentavos: 1000,
        quantidade: 3
      })

      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
        '2027-01-01',
        '2027-02-01',
        '2027-03-01'
      ])
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
      expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
        '2027-05-01',
        '2027-06-01',
        '2027-07-01'
      ])
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

/**
 * A extensão preguiçosa do horizonte já conhece o mês de referência onde a
 * próxima ocorrência tem de cair — ele sai de `calcularExtensaoNecessaria`.
 * Passar esse mês por `gerarOcorrenciasAssinatura` obrigava a inventar uma
 * data de compra (`YYYY-MM-01`) e a reaplicar a RN-01 sobre ela, e a RN-01
 * manda a compra do dia F para a fatura seguinte: com `diaFechamento = 1`,
 * `1 < 1` é falso e a série inteira deslizava um mês.
 *
 * Esta entrada existe para o caller que já sabe o mês e não deveria passar
 * pela RN-01 de novo.
 */
describe('gerarOcorrenciasAPartirDoMes (RN-04, mês já conhecido)', () => {
  it('começa exatamente no mês pedido, sem reaplicar a RN-01', () => {
    const ocorrencias = gerarOcorrenciasAPartirDoMes({
      mesReferenciaInicial: '2027-02',
      valorMensalCentavos: 2000,
      ocorrenciaInicial: 13,
      quantidade: 3
    })

    expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
      '2027-02-01',
      '2027-03-01',
      '2027-04-01'
    ])
  })

  it('não depende do cartão: o mês pedido manda, qualquer que seja o fechamento', () => {
    // O caso que quebrava. Antes, dia de fechamento 1 empurrava tudo um mês.
    const ocorrencias = gerarOcorrenciasAPartirDoMes({
      mesReferenciaInicial: '2027-02',
      valorMensalCentavos: 2000,
      quantidade: 1
    })

    expect(ocorrencias[0].dataReferencia).toBe('2027-02-01')
  })

  it('continua a numeração a partir de ocorrenciaInicial', () => {
    const ocorrencias = gerarOcorrenciasAPartirDoMes({
      mesReferenciaInicial: '2026-05',
      valorMensalCentavos: 1000,
      ocorrenciaInicial: 13,
      quantidade: 3
    })

    expect(ocorrencias.map((o) => o.numero)).toEqual([13, 14, 15])
    for (const o of ocorrencias) expect(o.total).toBeNull()
  })

  it('atravessa a virada de ano', () => {
    const ocorrencias = gerarOcorrenciasAPartirDoMes({
      mesReferenciaInicial: '2026-11',
      valorMensalCentavos: 1000,
      quantidade: 4
    })

    expect(ocorrencias.map((o) => o.dataReferencia)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01'
    ])
  })

  it('valida quantidade, ocorrenciaInicial, valor e formato do mês', () => {
    const base = { mesReferenciaInicial: '2026-05', valorMensalCentavos: 1000, quantidade: 1 }

    expect(() => gerarOcorrenciasAPartirDoMes({ ...base, quantidade: 0 })).toThrow(/quantidade/)
    expect(() => gerarOcorrenciasAPartirDoMes({ ...base, ocorrenciaInicial: 0 })).toThrow(
      /ocorrenciaInicial/
    )
    expect(() => gerarOcorrenciasAPartirDoMes({ ...base, valorMensalCentavos: 0 })).toThrow(
      /valor/i
    )
    expect(() => gerarOcorrenciasAPartirDoMes({ ...base, mesReferenciaInicial: '2026-5' })).toThrow(
      /m[êe]s/i
    )
  })
})
