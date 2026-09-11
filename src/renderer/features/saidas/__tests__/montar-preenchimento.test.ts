import { describe, it, expect } from 'vitest'
import type { DespesaComTags } from '@shared/ipc/despesa'
import { montarPreenchimentoDespesa } from '../montar-preenchimento'
import { parseCentavos } from '../../../lib/dinheiro'

function despesa(over: Partial<DespesaComTags>): DespesaComTags {
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
    diaCobranca: null,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '2026-06-02',
    updatedAt: '2026-06-02',
    tags: [],
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
      valorReais: '180,00',
      tags: []
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
      totalParcelas: 12,
      tags: []
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
      valorReais: '39,90',
      tags: []
    })
  })
})

describe('montarPreenchimentoDespesa — o valor volta legivel para o formulario', () => {
  // O preenchimento usava `formatarValorCsv`, o formatador do EXPORT de CSV,
  // para preencher um campo de tela. Os dois produzem o mesmo texto para valor
  // positivo, entao nunca houve defeito visivel — mas sao gramaticas de dois
  // lados diferentes do app, e a do formulario tem uma garantia que a do CSV
  // nao tem: o campo abre com algo que ele proprio aceita de volta.
  //
  // Este teste fixa essa garantia, que e o motivo da troca por
  // `centavosParaReais`.
  it.each([1, 50, 100, 1999, 123456, 99999999])(
    'preenche %d centavos com um texto que o parseCentavos le de volta',
    (centavos) => {
      const preenchimento = montarPreenchimentoDespesa(despesa({ valorCentavos: centavos }))

      expect(parseCentavos(preenchimento.valorReais)).toBe(centavos)
    }
  )

  it('nao usa separador de milhar, para o ida-e-volta ser trivial', () => {
    const preenchimento = montarPreenchimentoDespesa(despesa({ valorCentavos: 123456789 }))

    expect(preenchimento.valorReais).toBe('1234567,89')
  })
})

/**
 * RF-DES-11 — as tags acompanham a cópia; a nota, não.
 *
 * Tag classifica o gasto, e uma compra repetida cai na mesma classificação.
 * Nota costuma ser sobre aquele lançamento específico, e herdá-la afirmaria
 * algo que o usuário não escreveu para esta compra.
 */
describe('montarPreenchimentoDespesa — tags', () => {
  it('copia as tags da despesa de origem', () => {
    const p = montarPreenchimentoDespesa(despesa({ tags: ['trabalho', 'eletronicos'] }))
    expect(p.tags).toEqual(['trabalho', 'eletronicos'])
  })

  it('copia as tags também em parcelada e assinatura', () => {
    expect(montarPreenchimentoDespesa(despesa({ tipo: 'Parcelada', tags: ['casa'] })).tags).toEqual(
      ['casa']
    )
    expect(
      montarPreenchimentoDespesa(despesa({ tipo: 'Assinatura', tags: ['streaming'] })).tags
    ).toEqual(['streaming'])
  })

  it('despesa sem tags produz lista vazia, e não undefined', () => {
    expect(montarPreenchimentoDespesa(despesa({})).tags).toEqual([])
  })

  it('não carrega a nota da origem', () => {
    const p = montarPreenchimentoDespesa(despesa({ nota: 'Reembolsável pela viagem de março' }))
    expect(p).not.toHaveProperty('nota')
  })
})
