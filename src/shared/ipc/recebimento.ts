import { z } from 'zod'
import type { Recebimento, StatusRecebimento } from '../../domain/entities/recebimento'
import { dataIsoSchema } from './date-schema'

const valorSchema = z
  .number({ message: 'Valor é obrigatório' })
  .int()
  .min(1, 'Valor deve ser maior que zero')

export const criarRecebimentoAvulsoInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(80, 'Descrição deve ter no máximo 80 caracteres'),
  valorCentavos: valorSchema,
  dataEsperada: dataIsoSchema,
  dataRecebida: dataIsoSchema.optional()
})

export type CriarRecebimentoAvulsoInput = z.infer<typeof criarRecebimentoAvulsoInputSchema>

export const marcarRecebidoInputSchema = z.object({
  recebimentoId: z.number().int().positive(),
  dataRecebida: dataIsoSchema
})

export type MarcarRecebidoInput = z.infer<typeof marcarRecebidoInputSchema>

export const excluirRecebimentoInputSchema = z.object({
  recebimentoId: z.number().int().positive()
})

export type ExcluirRecebimentoInput = z.infer<typeof excluirRecebimentoInputSchema>

export const listarRecebimentosInputSchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')
    .optional(),
  status: z.enum(['Esperado', 'Recebido']).optional()
})

export type ListarRecebimentosInput = z.infer<typeof listarRecebimentosInputSchema>

export type RecebimentoComContexto = Recebimento & {
  rendaNome: string | null
}

export type ResultadoCriarRecebimentoAvulso = {
  recebimento: Recebimento
}

export type RecebimentoApi = {
  criarAvulso: (input: CriarRecebimentoAvulsoInput) => Promise<ResultadoCriarRecebimentoAvulso>
  listar: (input?: ListarRecebimentosInput) => Promise<RecebimentoComContexto[]>
  marcarRecebido: (input: MarcarRecebidoInput) => Promise<Recebimento>
  excluir: (input: ExcluirRecebimentoInput) => Promise<void>
}

export const RECEBIMENTO_IPC_CHANNELS = {
  criarAvulso: 'recebimento:criar-avulso',
  listar: 'recebimento:listar',
  marcarRecebido: 'recebimento:marcar-recebido',
  excluir: 'recebimento:excluir'
} as const

export type { StatusRecebimento }
