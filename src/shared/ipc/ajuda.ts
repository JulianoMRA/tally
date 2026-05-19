import { z } from 'zod'
import type { Ajuda, StatusAjuda } from '../../domain/entities/ajuda'
import type { Contribuidor } from '../../domain/entities/contribuidor'

const dataBRSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((d) => !isNaN(new Date(d).getTime()), 'Data inválida')

export const criarAjudaInputSchema = z.object({
  contribuidorId: z.number({ message: 'Contribuidor é obrigatório' }).int().positive(),
  parcelaId: z.number({ message: 'Parcela é obrigatória' }).int().positive(),
  valorCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  recorrente: z.boolean()
})

export type CriarAjudaInput = z.infer<typeof criarAjudaInputSchema>

export const marcarAjudaRecebidaInputSchema = z.object({
  ajudaId: z.number().int().positive(),
  dataRecebimento: dataBRSchema
})

export type MarcarAjudaRecebidaInput = z.infer<typeof marcarAjudaRecebidaInputSchema>

export const excluirAjudaInputSchema = z.object({
  ajudaId: z.number().int().positive()
})

export type ExcluirAjudaInput = z.infer<typeof excluirAjudaInputSchema>

export const listarAjudasPorParcelaInputSchema = z.object({
  parcelaId: z.number().int().positive()
})

export type ListarAjudasPorParcelaInput = z.infer<typeof listarAjudasPorParcelaInputSchema>

export const listarAjudasAgrupadasInputSchema = z.object({
  status: z.enum(['Pendente', 'Recebida']).optional()
})

export type ListarAjudasAgrupadasInput = z.infer<typeof listarAjudasAgrupadasInputSchema>

export type ResultadoCriarAjuda = {
  criadas: Ajuda[]
}

export type AjudaComContexto = Ajuda & {
  descricaoDespesa: string
  mesReferencia: string | null
  dataReferenciaParcela: string
}

export type AjudaAgrupada = {
  contribuidor: Contribuidor
  totalCentavos: number
  totalPendentesCentavos: number
  ajudas: AjudaComContexto[]
}

export type AjudaApi = {
  criar: (input: CriarAjudaInput) => Promise<ResultadoCriarAjuda>
  marcarRecebida: (input: MarcarAjudaRecebidaInput) => Promise<Ajuda>
  excluir: (input: ExcluirAjudaInput) => Promise<void>
  listarPorParcela: (input: ListarAjudasPorParcelaInput) => Promise<Ajuda[]>
  listarAgrupadoPorContribuidor: (input?: ListarAjudasAgrupadasInput) => Promise<AjudaAgrupada[]>
}

export const AJUDA_IPC_CHANNELS = {
  criar: 'ajuda:criar',
  marcarRecebida: 'ajuda:marcar-recebida',
  excluir: 'ajuda:excluir',
  listarPorParcela: 'ajuda:listar-por-parcela',
  listarAgrupadoPorContribuidor: 'ajuda:listar-agrupado'
} as const

export type { StatusAjuda }
