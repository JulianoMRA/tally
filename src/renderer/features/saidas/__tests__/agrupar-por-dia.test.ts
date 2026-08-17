import { describe, it, expect } from 'vitest'
import type { DespesaComTags } from '@shared/ipc/despesa'
import { agruparPorDia } from '../agrupar-por-dia'

let proximoId = 1

function despesa(overrides: Partial<DespesaComTags> = {}): DespesaComTags {
  return {
    id: proximoId++,
    descricao: 'Compra',
    categoriaId: 1,
    cartaoId: 1,
    formaPagamento: 'Credito',
    tipo: 'Unica',
    valorCentavos: 10000,
    dataCompra: '2026-08-14',
    ativa: true,
    tags: [],
    nota: null,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
    ...overrides
  } as DespesaComTags
}

describe('agruparPorDia', () => {
  it('junta lançamentos do mesmo dia num grupo só', () => {
    const grupos = agruparPorDia([
      despesa({ dataCompra: '2026-08-14', valorCentavos: 15000 }),
      despesa({ dataCompra: '2026-08-14', valorCentavos: 7270 })
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.data).toBe('2026-08-14')
    expect(grupos[0]?.itens).toHaveLength(2)
  })

  it('soma o subtotal de cada grupo', () => {
    const grupos = agruparPorDia([
      despesa({ dataCompra: '2026-08-14', valorCentavos: 15000 }),
      despesa({ dataCompra: '2026-08-14', valorCentavos: 7270 }),
      despesa({ dataCompra: '2026-08-12', valorCentavos: 8990 })
    ])

    expect(grupos[0]?.totalCentavos).toBe(22270)
    expect(grupos[1]?.totalCentavos).toBe(8990)
  })

  it('preserva a ordem recebida — quem ordena é o useOrdenacao', () => {
    const grupos = agruparPorDia([
      despesa({ dataCompra: '2026-08-12' }),
      despesa({ dataCompra: '2026-08-14' })
    ])

    expect(grupos.map((g) => g.data)).toEqual(['2026-08-12', '2026-08-14'])
  })

  // Só agrupa adjacentes: numa lista ordenada por valor as datas se intercalam,
  // e fundir tudo por data reescreveria a ordenação que o usuário pediu. É por
  // isso que a página só agrupa quando a ordenação é por data.
  it('não funde datas iguais que não são adjacentes', () => {
    const grupos = agruparPorDia([
      despesa({ dataCompra: '2026-08-14' }),
      despesa({ dataCompra: '2026-08-12' }),
      despesa({ dataCompra: '2026-08-14' })
    ])

    expect(grupos).toHaveLength(3)
  })

  it('devolve lista vazia sem itens', () => {
    expect(agruparPorDia([])).toEqual([])
  })

  it('não muta o array de entrada', () => {
    const itens = [despesa({ dataCompra: '2026-08-14' })]
    agruparPorDia(itens)

    expect(itens).toHaveLength(1)
  })

  it('soma corretamente um grupo de um item só', () => {
    const grupos = agruparPorDia([despesa({ valorCentavos: 4490 })])

    expect(grupos[0]?.totalCentavos).toBe(4490)
    expect(grupos[0]?.itens).toHaveLength(1)
  })
})
