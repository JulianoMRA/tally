import { describe, it, expect } from 'vitest'
import { gerarOcorrenciasSemCartao } from '../gerar-ocorrencias-assinatura'

const BASE = {
  mesReferenciaInicial: '2026-09',
  diaCobranca: 10,
  valorMensalCentavos: 150000,
  quantidade: 3
}

function datas(input: Parameters<typeof gerarOcorrenciasSemCartao>[0]): string[] {
  return gerarOcorrenciasSemCartao(input).map((o) => o.dataReferencia)
}

describe('gerarOcorrenciasSemCartao (RN-04, ramo sem cartão)', () => {
  it('gera as ocorrências no dia de cobrança pedido, mês a mês', () => {
    expect(datas(BASE)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10'])
  })

  it('não passa pela RN-01: o mês informado é o mês da primeira ocorrência', () => {
    // Sem cartão não há dia de fechamento a consultar. Reaplicar a RN-01 sobre
    // um mês já resolvido foi a origem do defeito do PR #130.
    const primeira = gerarOcorrenciasSemCartao({ ...BASE, quantidade: 1 })[0]

    expect(primeira.dataReferencia.slice(0, 7)).toBe('2026-09')
  })

  it('numera a partir de 1 e deixa `total` nulo (série sem fim definido)', () => {
    const ocorrencias = gerarOcorrenciasSemCartao(BASE)

    expect(ocorrencias.map((o) => o.numero)).toEqual([1, 2, 3])
    expect(ocorrencias.every((o) => o.total === null)).toBe(true)
    expect(ocorrencias.every((o) => o.valorCentavos === 150000)).toBe(true)
  })

  it('continua a numeração quando o horizonte é estendido', () => {
    const ocorrencias = gerarOcorrenciasSemCartao({
      ...BASE,
      mesReferenciaInicial: '2026-12',
      ocorrenciaInicial: 4,
      quantidade: 2
    })

    expect(ocorrencias.map((o) => o.numero)).toEqual([4, 5])
    expect(ocorrencias.map((o) => o.dataReferencia)).toEqual(['2026-12-10', '2027-01-10'])
  })

  it('mês curto usa o último dia', () => {
    expect(
      datas({ ...BASE, mesReferenciaInicial: '2026-02', diaCobranca: 31, quantidade: 1 })
    ).toEqual(['2026-02-28'])
  })

  it('o clamp NÃO é permanente: fevereiro encolhe, março volta a 31', () => {
    // É este o motivo de o dia viver em coluna própria em vez de sair da data
    // da primeira ocorrência (RF-DES-17).
    expect(
      datas({ ...BASE, mesReferenciaInicial: '2026-01', diaCobranca: 31, quantidade: 4 })
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('respeita fevereiro de ano bissexto', () => {
    expect(
      datas({ ...BASE, mesReferenciaInicial: '2028-02', diaCobranca: 31, quantidade: 1 })
    ).toEqual(['2028-02-29'])
  })

  it('atravessa a virada do ano', () => {
    expect(
      datas({ ...BASE, mesReferenciaInicial: '2026-11', diaCobranca: 5, quantidade: 3 })
    ).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
  })

  describe('limite de recorrência (RF-DES-18)', () => {
    it('corta a série na última ocorrência que cabe antes do limite', () => {
      // "até 15/03/2027" com cobrança dia 20: março cairia em 20/03, depois do
      // limite escrito, então a última é fevereiro.
      expect(
        datas({
          ...BASE,
          mesReferenciaInicial: '2027-01',
          diaCobranca: 20,
          quantidade: 6,
          recorreAte: '2027-03-15'
        })
      ).toEqual(['2027-01-20', '2027-02-20'])
    })

    it('inclui a ocorrência que cai exatamente no limite', () => {
      expect(
        datas({
          ...BASE,
          mesReferenciaInicial: '2027-01',
          diaCobranca: 20,
          quantidade: 6,
          recorreAte: '2027-03-20'
        })
      ).toEqual(['2027-01-20', '2027-02-20', '2027-03-20'])
    })

    it('limite anterior à primeira ocorrência devolve lista vazia', () => {
      expect(gerarOcorrenciasSemCartao({ ...BASE, recorreAte: '2026-08-31' })).toEqual([])
    })

    it('limite nulo não corta nada (recorrência sempre)', () => {
      expect(datas({ ...BASE, recorreAte: null })).toHaveLength(3)
    })

    it('o limite compara a data clampada, não o dia pedido', () => {
      // Cobrança dia 31 em fevereiro vira 28; com limite em 2026-02-28 ela cabe.
      expect(
        datas({
          ...BASE,
          mesReferenciaInicial: '2026-02',
          diaCobranca: 31,
          quantidade: 2,
          recorreAte: '2026-02-28'
        })
      ).toEqual(['2026-02-28'])
    })
  })

  describe('entradas inválidas', () => {
    it('recusa dia de cobrança fora de 1..31', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, diaCobranca: 0 })).toThrow(/dia/i)
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, diaCobranca: 32 })).toThrow(/dia/i)
    })

    it('recusa dia de cobrança não inteiro', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, diaCobranca: 10.5 })).toThrow(/dia/i)
    })

    it('recusa quantidade menor que 1', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, quantidade: 0 })).toThrow(/quantidade/i)
    })

    it('recusa valor mensal não positivo', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, valorMensalCentavos: 0 })).toThrow(/valor/i)
    })

    it('recusa mês de referência fora do formato', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, mesReferenciaInicial: '2026-13' })).toThrow(
        /mes|mês/i
      )
    })

    it('recusa limite fora do formato de data', () => {
      expect(() => gerarOcorrenciasSemCartao({ ...BASE, recorreAte: '15/03/2027' })).toThrow(
        /recorre|limite|data/i
      )
    })
  })
})
