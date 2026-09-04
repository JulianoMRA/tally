import { z } from 'zod'
import type { SimulacaoDoMes } from '../../domain/entities/simulacao'

const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')

/** Teto por mês. A simulação é rascunho; lista maior que isto é sinal de outra coisa. */
export const MAX_ITENS_SIMULACAO = 50

/** Teto de repetições de um item — 99 já passa de "todo dia do mês". */
export const MAX_REPETICOES_SIMULACAO = 99

export const MAX_DESCRICAO_SIMULACAO = 60

export const tipoItemSimulacaoSchema = z.enum(['entrada', 'saida'])

export const itemSimulacaoSchema = z.object({
  id: z.string().min(1).max(64),
  descricao: z.string().trim().min(1, 'Descrição é obrigatória').max(MAX_DESCRICAO_SIMULACAO),
  // `nonnegative`, não `positive`: valor zero é inofensivo (a RN-09 soma zero) e
  // recusá-lo só atrapalharia quem está montando a linha. Negativo, esse sim, é
  // proibido em todo o projeto — o sinal mora no `tipo`.
  valorCentavos: z.number().int().min(0, 'Valor não pode ser negativo'),
  repeticoes: z.number().int().min(1).max(MAX_REPETICOES_SIMULACAO),
  tipo: tipoItemSimulacaoSchema,
  ativo: z.boolean()
})

export const baseSimulacaoSchema = z.object({
  modo: z.enum(['mes', 'manual']),
  valorManualCentavos: z.number().int().min(0, 'Valor não pode ser negativo')
})

export const simulacaoDoMesSchema = z.object({
  base: baseSimulacaoSchema,
  itens: z.array(itemSimulacaoSchema).max(MAX_ITENS_SIMULACAO, 'Limite de itens do mês atingido')
})

/**
 * Estado inicial de um mês sem simulação. `mes` como padrão porque ancorar no
 * número que o app calcula é o que separa esta tela de uma calculadora comum.
 */
export const SIMULACAO_VAZIA: SimulacaoDoMes = {
  base: { modo: 'mes', valorManualCentavos: 0 },
  itens: []
}

export const obterSimulacaoInputSchema = z.object({
  mesReferencia: mesReferenciaSchema
})

export type ObterSimulacaoInput = z.infer<typeof obterSimulacaoInputSchema>

export const salvarSimulacaoInputSchema = z.object({
  mesReferencia: mesReferenciaSchema,
  simulacao: simulacaoDoMesSchema
})

export type SalvarSimulacaoInput = z.infer<typeof salvarSimulacaoInputSchema>

export type SimulacaoApi = {
  obter: (input: ObterSimulacaoInput) => Promise<SimulacaoDoMes>
  salvar: (input: SalvarSimulacaoInput) => Promise<SimulacaoDoMes>
}

export { SIMULACAO_IPC_CHANNELS } from './channels'

export type {
  ItemSimulacao,
  SimulacaoDoMes,
  TipoItemSimulacao
} from '../../domain/entities/simulacao'
