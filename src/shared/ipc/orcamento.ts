import { z } from 'zod'
import type { Orcamento } from '../../domain/entities/orcamento'
import type { LinhaOrcamento } from '../../domain/services/calcular-orcamento'

const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')

export const definirLimiteInputSchema = z.object({
  categoriaId: z.number().int().positive(),
  valorLimiteCentavos: z.number().int().min(0, 'Limite não pode ser negativo')
})

export type DefinirLimiteInput = z.infer<typeof definirLimiteInputSchema>

export const categoriaIdSchema = z.number().int().positive()

export const listarProgressoInputSchema = z.object({
  mesReferencia: mesReferenciaSchema
})

export type ListarProgressoInput = z.infer<typeof listarProgressoInputSchema>

export type OrcamentoApi = {
  definirLimite: (input: DefinirLimiteInput) => Promise<Orcamento>
  removerLimite: (categoriaId: number) => Promise<void>
  listarProgresso: (input: ListarProgressoInput) => Promise<LinhaOrcamento[]>
}

export { ORCAMENTO_IPC_CHANNELS } from './channels'
