// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { alfabetico, porData, porNumero } from '../comparadores'
import { ordenarPor, useOrdenacao } from '../use-ordenacao'

type Item = { id: number; nome: string; data: string; valor: number }

const ITENS: Item[] = [
  { id: 1, nome: 'Banana', data: '2026-03-10', valor: 300 },
  { id: 2, nome: 'Abacaxi', data: '2026-01-05', valor: 100 },
  { id: 3, nome: 'Caju', data: '2026-02-20', valor: 200 }
]

const COMPARADORES = {
  nome: alfabetico<Item>((i) => i.nome),
  data: porData<Item>((i) => i.data),
  valor: porNumero<Item>((i) => i.valor)
}

describe('ordenarPor', () => {
  it('ordena em ordem crescente sem mutar o array original', () => {
    const ordenado = ordenarPor(ITENS, COMPARADORES.valor, 'asc')
    expect(ordenado.map((i) => i.id)).toEqual([2, 3, 1])
    expect(ITENS.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('inverte a ordem em desc negando o comparador', () => {
    const ordenado = ordenarPor(ITENS, COMPARADORES.valor, 'desc')
    expect(ordenado.map((i) => i.id)).toEqual([1, 3, 2])
  })

  it('mantém ordem de entrada em empates (sort estável)', () => {
    const empatados: Item[] = [
      { id: 1, nome: 'x', data: '2026-01-01', valor: 50 },
      { id: 2, nome: 'y', data: '2026-01-01', valor: 50 },
      { id: 3, nome: 'z', data: '2026-01-01', valor: 50 }
    ]
    const ordenado = ordenarPor(empatados, COMPARADORES.data, 'asc')
    expect(ordenado.map((i) => i.id)).toEqual([1, 2, 3])
  })
})

describe('useOrdenacao', () => {
  it('inicia ordenado pela chave inicial em asc', () => {
    const { result } = renderHook(() => useOrdenacao(ITENS, COMPARADORES, 'data'))
    expect(result.current.sortBy).toBe('data')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.itensOrdenados.map((i) => i.id)).toEqual([2, 3, 1])
  })

  it('alterna asc/desc ao clicar na mesma coluna', () => {
    const { result } = renderHook(() => useOrdenacao(ITENS, COMPARADORES, 'data'))
    act(() => result.current.handleSort('data'))
    expect(result.current.sortDir).toBe('desc')
    expect(result.current.itensOrdenados.map((i) => i.id)).toEqual([1, 3, 2])
  })

  it('reseta para asc ao trocar de coluna', () => {
    const { result } = renderHook(() => useOrdenacao(ITENS, COMPARADORES, 'data'))
    act(() => result.current.handleSort('data'))
    act(() => result.current.handleSort('nome'))
    expect(result.current.sortBy).toBe('nome')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.itensOrdenados.map((i) => i.id)).toEqual([2, 1, 3])
  })

  it('exibe o indicador apenas na coluna ativa', () => {
    const { result } = renderHook(() => useOrdenacao(ITENS, COMPARADORES, 'data'))
    expect(result.current.sortIndicator('data')).toBe(' ↑')
    expect(result.current.sortIndicator('nome')).toBe('')
    act(() => result.current.handleSort('data'))
    expect(result.current.sortIndicator('data')).toBe(' ↓')
  })
})
