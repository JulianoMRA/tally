import { describe, it, expect } from 'vitest'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import { alturasDaSparkline, resumirCartao } from '../resumir-cartao'

let proximoId = 1

function fatura(mesReferencia: string, totalCentavos: number): FaturaComTotal {
  const id = proximoId++
  return {
    fatura: {
      id,
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status: { kind: 'Aberta' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    mesReferencia,
    totalCentavos
  }
}

describe('resumirCartao — fatura do mês', () => {
  it('traz o total da fatura do mês corrente', () => {
    const r = resumirCartao([fatura('2026-07', 50000), fatura('2026-08', 128490)], '2026-08')

    expect(r.aberturaCentavos).toBe(128490)
  })

  // Cartão sem compra no mês não tem fatura. Zero diria "gastei nada"; null
  // deixa a tela dizer "sem fatura", que é diferente.
  it('devolve null quando o cartão não tem fatura no mês', () => {
    const r = resumirCartao([fatura('2026-06', 50000)], '2026-08')

    expect(r.aberturaCentavos).toBeNull()
  })
})

describe('resumirCartao — série de 6 meses', () => {
  it('usa só meses encerrados, do mais antigo ao mais recente', () => {
    const r = resumirCartao(
      [fatura('2026-08', 999), fatura('2026-06', 200), fatura('2026-07', 300)],
      '2026-08'
    )

    expect(r.serie.map((p) => p.mes)).toEqual(['2026-06', '2026-07'])
  })

  // O mês corrente ainda está recebendo compras: incluí-lo puxaria a média
  // para baixo em todo dia 1º.
  it('exclui o mês corrente da série e da média', () => {
    const r = resumirCartao([fatura('2026-07', 100000), fatura('2026-08', 10)], '2026-08')

    expect(r.serie).toHaveLength(1)
    expect(r.mediaCentavos).toBe(100000)
  })

  it('mantém no máximo seis meses, descartando os mais antigos', () => {
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
    const r = resumirCartao(
      meses.map((m) => fatura(m, 1000)),
      '2026-08'
    )

    expect(r.serie).toHaveLength(6)
    expect(r.serie[0]?.mes).toBe('2026-02')
  })

  it('calcula a média dos meses da série', () => {
    const r = resumirCartao([fatura('2026-06', 100000), fatura('2026-07', 120000)], '2026-08')

    expect(r.mediaCentavos).toBe(110000)
  })

  it('sem histórico não há média', () => {
    const r = resumirCartao([fatura('2026-08', 5000)], '2026-08')

    expect(r.serie).toEqual([])
    expect(r.mediaCentavos).toBeNull()
  })

  // Cartão ocioso: os meses existem mas somam zero. "Média R$ 0,00" não é
  // referência — mesmo raciocínio da média de entradas em Rendas.
  it('histórico zerado não vira média zero', () => {
    const r = resumirCartao([fatura('2026-06', 0), fatura('2026-07', 0)], '2026-08')

    expect(r.mediaCentavos).toBeNull()
  })
})

describe('resumirCartao — frequência de uso', () => {
  it('conta os meses da série em que houve gasto', () => {
    const r = resumirCartao(
      [fatura('2026-05', 1000), fatura('2026-06', 0), fatura('2026-07', 2000)],
      '2026-08'
    )

    expect(r.mesesComUso).toBe(2)
  })

  it('cartão ocioso não tem mês com uso', () => {
    const r = resumirCartao([fatura('2026-06', 0), fatura('2026-07', 0)], '2026-08')

    expect(r.mesesComUso).toBe(0)
  })
})

describe('alturasDaSparkline', () => {
  it('escala pelo maior mês, que vira 100', () => {
    expect(alturasDaSparkline([{ totalCentavos: 500 }, { totalCentavos: 1000 }])).toEqual([50, 100])
  })

  // Barra zerada some, que é a leitura certa para "não usei neste mês".
  it('mês sem gasto fica em zero', () => {
    expect(alturasDaSparkline([{ totalCentavos: 0 }, { totalCentavos: 100 }])).toEqual([0, 100])
  })

  it('série toda zerada não divide por zero', () => {
    expect(alturasDaSparkline([{ totalCentavos: 0 }, { totalCentavos: 0 }])).toEqual([0, 0])
  })

  it('série vazia devolve lista vazia', () => {
    expect(alturasDaSparkline([])).toEqual([])
  })
})
