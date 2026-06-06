import { describe, it, expect } from 'vitest'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputBaseSchema,
  despesaEmAndamentoInputSchema,
  despesaAssinaturaCreditoInputSchema,
  despesaUnicaForaCartaoInputSchema,
  atualizarDespesaInputSchema
} from '../despesa'

const unicaCredito = {
  descricao: 'Notebook',
  categoriaId: 1,
  cartaoId: 1,
  valorCentavos: 1000,
  dataCompra: '2026-06-07'
}

const parcelada = {
  descricao: 'TV',
  categoriaId: 1,
  cartaoId: 1,
  totalParcelas: 12,
  valorTotalCentavos: 120000,
  dataCompra: '2026-06-07'
}

const emAndamento = {
  descricao: 'Geladeira',
  categoriaId: 1,
  cartaoId: 1,
  totalParcelas: 12,
  parcelaAtual: 7,
  valorRestanteCentavos: 60000,
  dataCompra: '2026-06-07'
}

const assinatura = {
  descricao: 'Spotify',
  categoriaId: 1,
  cartaoId: 1,
  valorMensalCentavos: 2000,
  dataInicio: '2026-06-07'
}

const foraCartao = {
  descricao: 'Mercado',
  categoriaId: 1,
  formaPagamento: 'Pix' as const,
  valorCentavos: 5000,
  dataCompra: '2026-06-07'
}

describe('despesaUnicaCreditoInputSchema', () => {
  it('aceita input válido', () => {
    expect(() => despesaUnicaCreditoInputSchema.parse(unicaCredito)).not.toThrow()
  })

  it('rejeita descrição vazia', () => {
    expect(() => despesaUnicaCreditoInputSchema.parse({ ...unicaCredito, descricao: '' })).toThrow()
  })

  it('rejeita valor zero', () => {
    expect(() =>
      despesaUnicaCreditoInputSchema.parse({ ...unicaCredito, valorCentavos: 0 })
    ).toThrow()
  })

  it('rejeita data de calendário impossível (30 de fevereiro)', () => {
    expect(() =>
      despesaUnicaCreditoInputSchema.parse({ ...unicaCredito, dataCompra: '2026-02-30' })
    ).toThrow()
  })
})

describe('despesaParceladaCreditoInputSchema', () => {
  it('aceita input válido', () => {
    expect(() => despesaParceladaCreditoInputSchema.parse(parcelada)).not.toThrow()
  })

  it('rejeita menos de 2 parcelas', () => {
    expect(() =>
      despesaParceladaCreditoInputSchema.parse({ ...parcelada, totalParcelas: 1 })
    ).toThrow()
  })
})

describe('despesaEmAndamentoInputBaseSchema (objeto puro, sem refine)', () => {
  it('aceita input válido', () => {
    expect(() => despesaEmAndamentoInputBaseSchema.parse(emAndamento)).not.toThrow()
  })

  it('permanece extensível via .omit (regressão do bug ZodEffects)', () => {
    expect(() =>
      despesaEmAndamentoInputBaseSchema.omit({ valorRestanteCentavos: true })
    ).not.toThrow()
  })
})

describe('despesaEmAndamentoInputSchema (com refine cross-field)', () => {
  it('aceita parcelaAtual <= totalParcelas', () => {
    expect(() => despesaEmAndamentoInputSchema.parse(emAndamento)).not.toThrow()
  })

  it('rejeita parcelaAtual > totalParcelas', () => {
    expect(() =>
      despesaEmAndamentoInputSchema.parse({ ...emAndamento, parcelaAtual: 13, totalParcelas: 12 })
    ).toThrow()
  })
})

describe('despesaAssinaturaCreditoInputSchema', () => {
  it('aceita input válido', () => {
    expect(() => despesaAssinaturaCreditoInputSchema.parse(assinatura)).not.toThrow()
  })

  it('rejeita data de início inválida', () => {
    expect(() =>
      despesaAssinaturaCreditoInputSchema.parse({ ...assinatura, dataInicio: '2026-13-01' })
    ).toThrow()
  })
})

describe('despesaUnicaForaCartaoInputSchema', () => {
  it('aceita Pix, Debito e Dinheiro', () => {
    expect(() => despesaUnicaForaCartaoInputSchema.parse(foraCartao)).not.toThrow()
    expect(() =>
      despesaUnicaForaCartaoInputSchema.parse({ ...foraCartao, formaPagamento: 'Debito' })
    ).not.toThrow()
    expect(() =>
      despesaUnicaForaCartaoInputSchema.parse({ ...foraCartao, formaPagamento: 'Dinheiro' })
    ).not.toThrow()
  })

  it('rejeita Credito (fora de cartão não é crédito)', () => {
    expect(() =>
      despesaUnicaForaCartaoInputSchema.parse({ ...foraCartao, formaPagamento: 'Credito' })
    ).toThrow()
  })
})

describe('atualizarDespesaInputSchema', () => {
  const base = { despesaId: 1, descricao: 'Novo nome', categoriaId: 1, valorCentavos: 1000 }

  it('aceita input mínimo sem dataCompra', () => {
    expect(() => atualizarDespesaInputSchema.parse(base)).not.toThrow()
  })

  it('aceita descrição com 120 caracteres (alinhado à criação)', () => {
    expect(() =>
      atualizarDespesaInputSchema.parse({ ...base, descricao: 'a'.repeat(120) })
    ).not.toThrow()
  })

  it('rejeita descrição com 121 caracteres', () => {
    expect(() =>
      atualizarDespesaInputSchema.parse({ ...base, descricao: 'a'.repeat(121) })
    ).toThrow()
  })

  it('rejeita dataCompra de calendário impossível', () => {
    expect(() => atualizarDespesaInputSchema.parse({ ...base, dataCompra: '2026-04-31' })).toThrow()
  })
})
