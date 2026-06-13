import { describe, expect, it } from 'vitest'
import { alfabetico, porData, porNumero } from '../comparadores'

type Item = { nome: string | null; data: string; valor: number }

describe('alfabetico', () => {
  it('ordena strings respeitando acentos do pt-BR', () => {
    const cmp = alfabetico<Item>((i) => i.nome)
    const a: Item = { nome: 'Água', data: '', valor: 0 }
    const b: Item = { nome: 'Zebra', data: '', valor: 0 }
    expect(cmp(a, b)).toBeLessThan(0)
  })

  it('é case-insensitive na ordenação', () => {
    const cmp = alfabetico<Item>((i) => i.nome)
    const a: Item = { nome: 'banana', data: '', valor: 0 }
    const b: Item = { nome: 'Abacaxi', data: '', valor: 0 }
    expect(cmp(a, b)).toBeGreaterThan(0)
  })

  it('trata null/undefined como string vazia (vai para o início em asc)', () => {
    const cmp = alfabetico<Item>((i) => i.nome)
    const semNome: Item = { nome: null, data: '', valor: 0 }
    const comNome: Item = { nome: 'Aluguel', data: '', valor: 0 }
    expect(cmp(semNome, comNome)).toBeLessThan(0)
  })
})

describe('porData', () => {
  it('ordena datas ISO cronologicamente via comparação de string', () => {
    const cmp = porData<Item>((i) => i.data)
    const a: Item = { nome: '', data: '2026-01-05', valor: 0 }
    const b: Item = { nome: '', data: '2026-12-31', valor: 0 }
    expect(cmp(a, b)).toBeLessThan(0)
  })

  it('trata valores ausentes como string vazia', () => {
    const cmp = porData<Item>((i) => i.data)
    const a: Item = { nome: '', data: '', valor: 0 }
    const b: Item = { nome: '', data: '2026-01-01', valor: 0 }
    expect(cmp(a, b)).toBeLessThan(0)
  })
})

describe('porNumero', () => {
  it('ordena numericamente de forma crescente', () => {
    const cmp = porNumero<Item>((i) => i.valor)
    const a: Item = { nome: '', data: '', valor: 1000 }
    const b: Item = { nome: '', data: '', valor: 2500 }
    expect(cmp(a, b)).toBeLessThan(0)
    expect(cmp(b, a)).toBeGreaterThan(0)
    expect(cmp(a, a)).toBe(0)
  })
})
