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

export type DespesaApi = {
  criarUnicaCredito: (input: DespesaUnicaCreditoInput) => Promise<ResultadoCriarDespesa>
}

export const DESPESA_IPC_CHANNELS = {
  criarUnicaCredito: 'despesa:criar-unica-credito'
} as const
