import { describe, it, expect } from 'vitest'
import type { ItemSimulacao } from '../../entities/simulacao'
import { calcularSimulacao } from '../calcular-simulacao'

function item(parcial: Partial<ItemSimulacao> = {}): ItemSimulacao {
  return {
    id: 'i1',
    descricao: 'Hipótese',
    valorCentavos: 10000,
    repeticoes: 1,
    tipo: 'saida',
    ativo: true,
    ...parcial
  }
}

describe('calcularSimulacao (RN-09)', () => {
  it('sem item nenhum devolve a base intacta', () => {
    const r = calcularSimulacao(20000, [])

    expect(r.baseCentavos).toBe(20000)
    expect(r.totalEntradasCentavos).toBe(0)
    expect(r.totalSaidasCentavos).toBe(0)
    expect(r.saldoSimuladoCentavos).toBe(20000)
  })

  it('saída ativa sai da base', () => {
    const r = calcularSimulacao(20000, [item({ valorCentavos: 5000 })])

    expect(r.totalSaidasCentavos).toBe(5000)
    expect(r.saldoSimuladoCentavos).toBe(15000)
  })

  it('entrada ativa soma à base', () => {
    const r = calcularSimulacao(20000, [item({ tipo: 'entrada', valorCentavos: 5000 })])

    expect(r.totalEntradasCentavos).toBe(5000)
    expect(r.saldoSimuladoCentavos).toBe(25000)
  })

  it('repetições multiplicam o valor do item', () => {
    // "100 por fim de semana, quatro fins de semana no mês"
    const r = calcularSimulacao(50000, [item({ valorCentavos: 10000, repeticoes: 4 })])

    expect(r.totalSaidasCentavos).toBe(40000)
    expect(r.saldoSimuladoCentavos).toBe(10000)
  })

  it('item desligado não entra em nenhum dos dois totais', () => {
    const itens = [
      item({ id: 'a', valorCentavos: 10000, ativo: false }),
      item({ id: 'b', tipo: 'entrada', valorCentavos: 30000, ativo: false }),
      item({ id: 'c', valorCentavos: 2500 })
    ]

    const r = calcularSimulacao(20000, itens)

    expect(r.totalSaidasCentavos).toBe(2500)
    expect(r.totalEntradasCentavos).toBe(0)
    expect(r.saldoSimuladoCentavos).toBe(17500)
  })

  it('mistura entradas e saídas com repetições diferentes', () => {
    const itens = [
      item({ id: 'a', descricao: 'Fim de semana', valorCentavos: 10000, repeticoes: 4 }),
      item({ id: 'b', descricao: 'Almoço', valorCentavos: 2500, repeticoes: 20 }),
      item({ id: 'c', descricao: 'Freela', tipo: 'entrada', valorCentavos: 60000, repeticoes: 2 })
    ]

    const r = calcularSimulacao(15000, itens)

    expect(r.totalSaidasCentavos).toBe(90000)
    expect(r.totalEntradasCentavos).toBe(120000)
    expect(r.saldoSimuladoCentavos).toBe(45000)
  })

  it('base negativa é preservada: o mês já podia estar no vermelho', () => {
    const r = calcularSimulacao(-30000, [item({ tipo: 'entrada', valorCentavos: 10000 })])

    expect(r.baseCentavos).toBe(-30000)
    expect(r.saldoSimuladoCentavos).toBe(-20000)
  })

  it('saldo simulado fica negativo quando as saídas passam da base', () => {
    const r = calcularSimulacao(10000, [item({ valorCentavos: 25000 })])

    expect(r.saldoSimuladoCentavos).toBe(-15000)
  })

  it('recusa valor de item negativo: só a base pode ser negativa', () => {
    expect(() => calcularSimulacao(0, [item({ valorCentavos: -100 })])).toThrow(/valor.*negativ/i)
  })

  it('recusa repetições menores que 1', () => {
    expect(() => calcularSimulacao(0, [item({ repeticoes: 0 })])).toThrow(/repeti/i)
  })

  it('recusa repetições não inteiras', () => {
    expect(() => calcularSimulacao(0, [item({ repeticoes: 1.5 })])).toThrow(/repeti/i)
  })

  it('não altera a lista recebida', () => {
    const itens = [item({ valorCentavos: 5000 })]
    const copia = structuredClone(itens)

    calcularSimulacao(1000, itens)

    expect(itens).toEqual(copia)
  })
})
