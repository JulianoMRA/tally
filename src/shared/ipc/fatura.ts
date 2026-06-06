import { z } from 'zod'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'

const idSchema = z.number().int().positive()

const dataBRSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((d) => !isNaN(new Date(d).getTime()), 'Data inválida')

export const faturaIdSchema = idSchema
export const cartaoIdSchema = idSchema

export const pagarFaturaInputSchema = z.object({
  faturaId: idSchema,
  dataPagamento: dataBRSchema
})

export type PagarFaturaInput = z.infer<typeof pagarFaturaInputSchema>

export type FaturaDetalhada = {
  fatura: Fatura
  parcelas: Parcela[]
  totalCentavos: number
  /**
   * Mapa parcelaId → despesa associada. Permite exibir descrição na tabela
   * e pré-popular o EditarDespesaModal sem round-trip extra. Slice 14.1.
   */
  despesasPorParcela?: Record<number, Despesa>
}

export type FaturaApi = {
  listarPorCartao: (cartaoId: number) => Promise<Fatura[]>
  detalharComParcelas: (faturaId: number) => Promise<FaturaDetalhada | null>
  fechar: (faturaId: number) => Promise<Fatura>
  pagar: (faturaId: number, dataPagamento: string) => Promise<Fatura>
  reabrir: (faturaId: number) => Promise<Fatura>
}

export { FATURA_IPC_CHANNELS } from './channels'
