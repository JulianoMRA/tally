import { z } from 'zod'
import type { Recebimento, StatusRecebimento } from '../../domain/entities/recebimento'
import { dataIsoSchema } from './date-schema'

const valorSchema = z
  .number({ message: 'Valor é obrigatório' })
  .int()
  .min(1, 'Valor deve ser maior que zero')

const descricaoSchema = z
  .string()
  .trim()
  .min(1, 'Descrição é obrigatória')
  .max(80, 'Descrição deve ter no máximo 80 caracteres')

const camposComunsAvulso = {
  descricao: descricaoSchema,
  valorCentavos: valorSchema,
  dataEsperada: dataIsoSchema,
  dataRecebida: dataIsoSchema.optional()
}

/**
 * Entrada avulsa: nome proprio, sem fonte de renda.
 *
 * Era uma `z.union` de `{ nome }` (criava fonte) ou `{ rendaId }` (reusava
 * fonte existente), porque `recebimento` nao tinha coluna de nome. Desde a
 * migration 0011 ele tem, e fonte de renda passou a existir so para entrada
 * constante — nao ha mais o que escolher.
 */
export const criarRecebimentoAvulsoInputSchema = z.object(camposComunsAvulso)

export type CriarRecebimentoAvulsoInput = z.infer<typeof criarRecebimentoAvulsoInputSchema>

/** Edicao de entrada avulsa. Recebimento de fonte recorrente e recusado no repo. */
export const atualizarRecebimentoInputSchema = z.object({
  recebimentoId: z.number().int().positive(),
  ...camposComunsAvulso
})

export type AtualizarRecebimentoInput = z.infer<typeof atualizarRecebimentoInputSchema>

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

/**
 * Recebimento com o nome ja resolvido: vem da fonte quando `rendaId` esta
 * preenchido, e da propria linha quando e avulso. Poupa cada tela de repetir
 * o fallback — eram sete pontos de leitura fazendo `?? '—'` de jeitos
 * ligeiramente diferentes.
 */
export type RecebimentoComContexto = Recebimento & {
  nome: string
}

export type ResultadoCriarRecebimentoAvulso = {
  recebimento: Recebimento
}

export type RecebimentoApi = {
  criarAvulso: (input: CriarRecebimentoAvulsoInput) => Promise<ResultadoCriarRecebimentoAvulso>
  listar: (input?: ListarRecebimentosInput) => Promise<RecebimentoComContexto[]>
  marcarRecebido: (input: MarcarRecebidoInput) => Promise<Recebimento>
  /** Edita uma entrada avulsa. Recusa recebimento vindo de fonte recorrente. */
  atualizar: (input: AtualizarRecebimentoInput) => Promise<Recebimento>
  excluir: (input: ExcluirRecebimentoInput) => Promise<void>
}

export { RECEBIMENTO_IPC_CHANNELS } from './channels'

export type { StatusRecebimento }
