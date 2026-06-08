import { describe, expect, it } from 'vitest'
import { calcularStatusOrcamento, montarVisaoOrcamento } from '../calcular-orcamento'

describe('calcularStatusOrcamento', () => {
  it('retorna ok com 0% quando nada foi realizado', () => {
    expect(calcularStatusOrcamento(10000, 0)).toEqual({ percentual: 0, status: 'ok' })
  })

  it('mantem ok logo abaixo do limiar de alerta', () => {
    expect(calcularStatusOrcamento(10000, 7900)).toEqual({ percentual: 79, status: 'ok' })
  })

  it('entra em alerta exatamente em 80%', () => {
    expect(calcularStatusOrcamento(10000, 8000)).toEqual({ percentual: 80, status: 'alerta' })
  })

  it('mantem alerta em 99%', () => {
    expect(calcularStatusOrcamento(10000, 9900)).toEqual({ percentual: 99, status: 'alerta' })
  })

  it('estoura exatamente em 100%', () => {
    expect(calcularStatusOrcamento(10000, 10000)).toEqual({ percentual: 100, status: 'estourado' })
  })

  it('estoura acima de 100%', () => {
    expect(calcularStatusOrcamento(10000, 15000)).toEqual({ percentual: 150, status: 'estourado' })
  })

  it('arredonda o percentual', () => {
    expect(calcularStatusOrcamento(3000, 1000)).toEqual({ percentual: 33, status: 'ok' })
  })

  it('trata limite zero sem realizado como ok', () => {
    expect(calcularStatusOrcamento(0, 0)).toEqual({ percentual: 0, status: 'ok' })
  })

  it('trata limite zero com realizado como estourado', () => {
    expect(calcularStatusOrcamento(0, 500)).toEqual({ percentual: 100, status: 'estourado' })
  })
})

describe('montarVisaoOrcamento', () => {
  it('retorna array vazio quando nao ha limites', () => {
    expect(montarVisaoOrcamento([], [{ categoriaId: 1, totalCentavos: 500 }])).toEqual([])
  })

  it('itera sobre os limites e cruza com o realizado do mes', () => {
    const linhas = montarVisaoOrcamento(
      [
        { categoriaId: 1, categoriaNome: 'Mercado', cor: '#4caf50', limiteCentavos: 50000 },
        { categoriaId: 2, categoriaNome: 'Lazer', cor: '#2196f3', limiteCentavos: 20000 }
      ],
      [
        { categoriaId: 1, totalCentavos: 45000 },
        { categoriaId: 2, totalCentavos: 5000 }
      ]
    )
    expect(linhas).toEqual([
      {
        categoriaId: 1,
        categoriaNome: 'Mercado',
        cor: '#4caf50',
        limiteCentavos: 50000,
        realizadoCentavos: 45000,
        percentual: 90,
        status: 'alerta'
      },
      {
        categoriaId: 2,
        categoriaNome: 'Lazer',
        cor: '#2196f3',
        limiteCentavos: 20000,
        realizadoCentavos: 5000,
        percentual: 25,
        status: 'ok'
      }
    ])
  })

  it('considera realizado zero quando a categoria nao tem gasto no mes', () => {
    const linhas = montarVisaoOrcamento(
      [{ categoriaId: 9, categoriaNome: 'Saude', cor: '#e91e63', limiteCentavos: 10000 }],
      []
    )
    expect(linhas).toEqual([
      {
        categoriaId: 9,
        categoriaNome: 'Saude',
        cor: '#e91e63',
        limiteCentavos: 10000,
        realizadoCentavos: 0,
        percentual: 0,
        status: 'ok'
      }
    ])
  })

  it('ordena por percentual decrescente (mais critico primeiro)', () => {
    const linhas = montarVisaoOrcamento(
      [
        { categoriaId: 1, categoriaNome: 'A', cor: '#111', limiteCentavos: 10000 },
        { categoriaId: 2, categoriaNome: 'B', cor: '#222', limiteCentavos: 10000 },
        { categoriaId: 3, categoriaNome: 'C', cor: '#333', limiteCentavos: 10000 }
      ],
      [
        { categoriaId: 1, totalCentavos: 5000 },
        { categoriaId: 2, totalCentavos: 12000 },
        { categoriaId: 3, totalCentavos: 8500 }
      ]
    )
    expect(linhas.map((l) => l.categoriaId)).toEqual([2, 3, 1])
  })
})
