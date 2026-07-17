import { describe, it, expect } from 'vitest'
import type { Despesa } from '@domain/entities/despesa'
import { montarPreenchimentoDespesa } from '../montar-preenchimento'

function despesa(over: Partial<Despesa>): Despesa {
  return {
    id: 1,
    descricao: 'Base',
    categoriaId: 3,
    tipo: 'Unica',
    formaPagamento: 'Credito',
    cartaoId: 5,
    valorCentavos: 18000,
    totalParcelas: 1,
    dataCompra: '2026-06-02',
    ativa: true,
    createdAt: '2026-06-02',
    updatedAt: '2026-06-02',
    ...over
  }
}

describe('montarPreenchimentoDespesa', () => {
  it('única de crédito → aba unica, forma Credito, valor formatado', () => {
    const p = montarPreenchimentoDespesa(despesa({ descricao: 'Mercado' }))
    expect(p).toEqual({
      tipo: 'unica',
      forma: 'Credito',
      descricao: 'Mercado (cópia)',
      categoriaId: 3,
      cartaoId: 5,
      valorReais: '180,00'
    })
  })

  it('única fora de cartão preserva a forma e o cartão nulo', () => {
    const p = montarPreenchimentoDespesa(
      despesa({ formaPagamento: 'Pix', cartaoId: null, valorCentavos: 2590 })
    )
    expect(p).toMatchObject({ tipo: 'unica', forma: 'Pix', cartaoId: null, valorReais: '25,90' })
  })

  it('parcelada → aba parcelada com total de parcelas e valor total', () => {
    const p = montarPreenchimentoDespesa(
      despesa({ tipo: 'Parcelada', totalParcelas: 12, valorCentavos: 120000 })
    )
    expect(p).toEqual({
      tipo: 'parcelada',
      descricao: 'Base (cópia)',
      categoriaId: 3,
      cartaoId: 5,
      valorReais: '1200,00',
      totalParcelas: 12
    })
  })

  it('assinatura → aba assinatura com valor mensal', () => {
    const p = montarPreenchimentoDespesa(
      despesa({ tipo: 'Assinatura', totalParcelas: null, valorCentavos: 3990 })
    )
    expect(p).toEqual({
      tipo: 'assinatura',
      descricao: 'Base (cópia)',
      categoriaId: 3,
      cartaoId: 5,
      valorReais: '39,90'
    })
  })
})
