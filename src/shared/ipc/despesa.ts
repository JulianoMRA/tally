import { z } from 'zod'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'

const dataBRSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((d) => !isNaN(new Date(d).getTime()), 'Data inválida')

export const despesaUnicaCreditoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(120, 'Descrição deve ter no máximo 120 caracteres'),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  cartaoId: z.number({ message: 'Cartão é obrigatório' }).int().positive('Cartão inválido'),
  valorCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataBRSchema
})

export type DespesaUnicaCreditoInput = z.infer<typeof despesaUnicaCreditoInputSchema>

export type ResultadoCriarDespesa = {
  despesa: Despesa
  fatura: Fatura
  parcela: Parcela
}

export const despesaParceladaCreditoInputSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(120, 'Descrição deve ter no máximo 120 caracteres'),
  categoriaId: z
    .number({ message: 'Categoria é obrigatória' })
    .int()
    .positive('Categoria inválida'),
  cartaoId: z.number({ message: 'Cartão é obrigatório' }).int().positive('Cartão inválido'),
  totalParcelas: z
    .number({ message: 'Total de parcelas é obrigatório' })
    .int()
    .min(2, 'Mínimo 2 parcelas')
    .max(360, 'Máximo 360 parcelas'),
  valorTotalCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataCompra: dataBRSchema
})

export type DespesaParceladaCreditoInput = z.infer<typeof despesaParceladaCreditoInputSchema>

export const despesaEmAndamentoInputSchema = despesaParceladaCreditoInputSchema
  .omit({ valorTotalCentavos: true })
  .extend({
    parcelaAtual: z.number().int().min(1, 'Parcela atual deve ser >= 1'),
    valorRestanteCentavos: z
      .number({ message: 'Valor restante é obrigatório' })
      .int()
      .min(1, 'Valor deve ser maior que zero')
  })
  .refine((d) => d.parcelaAtual <= d.totalParcelas, {
    message: 'Parcela atual não pode ser maior que total de parcelas',
    path: ['parcelaAtual']
  })

export type DespesaEmAndamentoInput = z.infer<typeof despesaEmAndamentoInputSchema>

export const adiantarParcelasInputSchema = z.object({
  despesaId: z.number().int().positive(),
  quantidade: z.number().int().min(1, 'Quantidade deve ser >= 1'),
  faturaDestinoId: z.number().int().positive()
})

export type AdiantarParcelasInput = z.infer<typeof adiantarParcelasInputSchema>

export const cancelarPendentesInputSchema = z.object({
  despesaId: z.number().int().positive()
})

export type CancelarPendentesInput = z.infer<typeof cancelarPendentesInputSchema>

export type ResultadoCriarParcelada = {
  despesa: Despesa
  parcelas: Parcela[]
}

export type ResultadoAdiantamento = {
  movidas: Parcela[]
  faturasAfetadas: number[]
}

export type ResultadoCancelamento = {
  canceladas: Parcela[]
}

export type DespesaApi = {
  criarUnicaCredito: (input: DespesaUnicaCreditoInput) => Promise<ResultadoCriarDespesa>
  criarParceladaCredito: (input: DespesaParceladaCreditoInput) => Promise<ResultadoCriarParcelada>
  criarParceladaEmAndamento: (input: DespesaEmAndamentoInput) => Promise<ResultadoCriarParcelada>
  adiantarParcelas: (input: AdiantarParcelasInput) => Promise<ResultadoAdiantamento>
  cancelarPendentes: (input: CancelarPendentesInput) => Promise<ResultadoCancelamento>
}

export const DESPESA_IPC_CHANNELS = {
  criarUnicaCredito: 'despesa:criar-unica-credito',
  criarParceladaCredito: 'despesa:criar-parcelada-credito',
  criarParceladaEmAndamento: 'despesa:criar-parcelada-em-andamento',
  adiantarParcelas: 'despesa:adiantar-parcelas',
  cancelarPendentes: 'despesa:cancelar-pendentes'
} as const
