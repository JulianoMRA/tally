import { z } from 'zod'
import type { Orcamento } from '../../domain/entities/orcamento'
import type { LinhaOrcamento } from '../../domain/services/calcular-orcamento'

const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')

// mesReferencia null = limite global (vale para todo mês); preenchido = limite
// daquele mês, que sobrepõe o global na visão do mês.
export const definirLimiteInputSchema = z.object({
  categoriaId: z.number().int().positive(),
  valorLimiteCentavos: z.number().int().min(0, 'Limite não pode ser negativo'),
  mesReferencia: mesReferenciaSchema.nullable()
})

export type DefinirLimiteInput = z.infer<typeof definirLimiteInputSchema>

export const removerLimiteInputSchema = z.object({
  categoriaId: z.number().int().positive(),
  mesReferencia: mesReferenciaSchema.nullable()
})

export type RemoverLimiteInput = z.infer<typeof removerLimiteInputSchema>

export const listarProgressoInputSchema = z.object({
  mesReferencia: mesReferenciaSchema
})

export type ListarProgressoInput = z.infer<typeof listarProgressoInputSchema>

export type OrigemLimite = 'mensal' | 'global'

export type LinhaOrcamentoComOrigem = LinhaOrcamento & { origem: OrigemLimite }

export type OrcamentoApi = {
  definirLimite: (input: DefinirLimiteInput) => Promise<Orcamento>
  removerLimite: (input: RemoverLimiteInput) => Promise<void>
  listarProgresso: (input: ListarProgressoInput) => Promise<LinhaOrcamentoComOrigem[]>
}

export { ORCAMENTO_IPC_CHANNELS } from './channels'
