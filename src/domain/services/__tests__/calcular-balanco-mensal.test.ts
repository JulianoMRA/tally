import { describe, it, expect } from 'vitest'
import { calcularBalancoMensal } from '../calcular-balanco-mensal'

describe('calcularBalancoMensal (RN-08)', () => {
  it('mês cheio com tudo recebido: saldo realizado = entradas − saídas', () => {
    const b = calcularBalancoMensal({
      totalFaturasCentavos: 80000,
      totalGastosForaCartaoCentavos: 20000,
      totalRecebidoCentavos: 150000,
      totalEsperadoCentavos: 0
    })

    expect(b.totalSaidasCentavos).toBe(100000)
    expect(b.totalEntradasRecebidasCentavos).toBe(150000)
    expect(b.totalEntradasProjetadasCentavos).toBe(150000)
    expect(b.saldoRealizadoCentavos).toBe(50000)
    expect(b.saldoProjetadoCentavos).toBe(50000)
  })

  it('mês com recebimento pendente: realizado negativo, projetado positivo', () => {
    const b = calcularBalancoMensal({
      totalFaturasCentavos: 30000,
      totalGastosForaCartaoCentavos: 0,
      totalRecebidoCentavos: 0,
      totalEsperadoCentavos: 100000
    })

    expect(b.saldoRealizadoCentavos).toBe(-30000)
    expect(b.saldoProjetadoCentavos).toBe(70000)
    expect(b.totalEntradasRecebidasCentavos).toBe(0)
    expect(b.totalEntradasProjetadasCentavos).toBe(100000)
  })

  it('mês negativo (faturas > recebimentos)', () => {
    const b = calcularBalancoMensal({
      totalFaturasCentavos: 200000,
      totalGastosForaCartaoCentavos: 50000,
      totalRecebidoCentavos: 100000,
      totalEsperadoCentavos: 0
    })

    expect(b.totalSaidasCentavos).toBe(250000)
    expect(b.saldoRealizadoCentavos).toBe(-150000)
    expect(b.saldoProjetadoCentavos).toBe(-150000)
  })

  it('mês vazio: tudo zerado', () => {
    const b = calcularBalancoMensal({
      totalFaturasCentavos: 0,
      totalGastosForaCartaoCentavos: 0,
      totalRecebidoCentavos: 0,
      totalEsperadoCentavos: 0
    })

    expect(b.totalSaidasCentavos).toBe(0)
    expect(b.totalEntradasRecebidasCentavos).toBe(0)
    expect(b.totalEntradasProjetadasCentavos).toBe(0)
    expect(b.saldoRealizadoCentavos).toBe(0)
    expect(b.saldoProjetadoCentavos).toBe(0)
  })

  it('só recebido e nada esperado: realizado = projetado', () => {
    const b = calcularBalancoMensal({
      totalFaturasCentavos: 10000,
      totalGastosForaCartaoCentavos: 0,
      totalRecebidoCentavos: 50000,
      totalEsperadoCentavos: 0
    })
    expect(b.saldoRealizadoCentavos).toBe(40000)
    expect(b.saldoProjetadoCentavos).toBe(40000)
  })
})
