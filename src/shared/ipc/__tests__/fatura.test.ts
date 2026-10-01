import { describe, it, expect } from 'vitest'
import { excluirPagamentoParcialInputSchema, registrarPagamentoParcialInputSchema } from '../fatura'

const pagamento = { faturaId: 1, valorCentavos: 20000, dataPagamento: '2026-10-10' }

/**
 * RN-10 na borda do IPC. O schema garante o que não depende do banco; o teto do
 * valor e o status da fatura são do domínio, e não aparecem aqui.
 */
describe('registrarPagamentoParcialInputSchema', () => {
  it('aceita input válido', () => {
    expect(registrarPagamentoParcialInputSchema.parse(pagamento)).toEqual(pagamento)
  })

  it('aceita o menor valor, de um centavo', () => {
    expect(() =>
      registrarPagamentoParcialInputSchema.parse({ ...pagamento, valorCentavos: 1 })
    ).not.toThrow()
  })

  it.each([
    ['zero', 0],
    ['negativo', -100],
    ['fracionário', 199.5],
    ['em texto', '200,00'],
    ['ausente', undefined]
  ])('rejeita valor %s', (_caso, valorCentavos) => {
    expect(() =>
      registrarPagamentoParcialInputSchema.parse({ ...pagamento, valorCentavos })
    ).toThrow()
  })

  it('diz em português por que recusou o valor zero', () => {
    const resultado = registrarPagamentoParcialInputSchema.safeParse({
      ...pagamento,
      valorCentavos: 0
    })

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toBe('Valor deve ser maior que zero')
  })

  it.each([
    ['de calendário impossível', '2026-02-30'],
    ['em formato brasileiro', '10/10/2026'],
    ['vazia', ''],
    ['ausente', undefined]
  ])('rejeita data %s', (_caso, dataPagamento) => {
    expect(() =>
      registrarPagamentoParcialInputSchema.parse({ ...pagamento, dataPagamento })
    ).toThrow()
  })

  it.each([
    ['zero', 0],
    ['negativa', -1],
    ['em texto', '1'],
    ['ausente', undefined]
  ])('rejeita faturaId %s', (_caso, faturaId) => {
    expect(() => registrarPagamentoParcialInputSchema.parse({ ...pagamento, faturaId })).toThrow()
  })
})

describe('excluirPagamentoParcialInputSchema', () => {
  it('aceita id inteiro positivo', () => {
    expect(excluirPagamentoParcialInputSchema.parse({ pagamentoId: 7 })).toEqual({ pagamentoId: 7 })
  })

  it.each([
    ['zero', 0],
    ['em texto', '7'],
    ['fracionário', 1.5],
    ['ausente', undefined]
  ])('rejeita id %s', (_caso, pagamentoId) => {
    expect(() => excluirPagamentoParcialInputSchema.parse({ pagamentoId })).toThrow()
  })
})
