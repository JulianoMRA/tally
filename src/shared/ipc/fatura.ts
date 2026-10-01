import { z } from 'zod'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'
import type { Ocorrencia } from '../../domain/services/descrever-ocorrencia'
import type { MotivoBloqueioExclusao } from '../../domain/services/regras-despesa'
import { dataIsoSchema } from './date-schema'

const idSchema = z.number().int().positive()

export const faturaIdSchema = idSchema
export const cartaoIdSchema = idSchema

export const pagarFaturaInputSchema = z.object({
  faturaId: idSchema,
  dataPagamento: dataIsoSchema
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
  /**
   * RF-DES-09 — despesaId → por que a exclusão está bloqueada. A despesa
   * ausente pode ser excluída. Vem do main porque a regra olha todas as
   * parcelas da despesa, e a fatura só traz as dela: a tela oferecia Excluir
   * em toda parcela pendente e descobria o bloqueio depois do diálogo.
   */
  exclusaoBloqueada?: Record<number, MotivoBloqueioExclusao>
  /**
   * RF-DES-14 — parcelaId → a ocorrência descrita por `descreverOcorrencia`, a
   * mesma função da lista de Saídas: rótulo da parcela ("à vista", "mensal",
   * "2/3") e o valor da compra quando ele é conhecido. A fatura montava o
   * rótulo por conta própria, e a mesma parcela tinha um nome em cada tela.
   */
  ocorrenciaPorParcela?: Record<number, Ocorrencia>
}

/**
 * Fatura com o total já somado. Existe para a LISTA de faturas: obter o total
 * por `detalharComParcelas` seria uma chamada por fatura, um N+1 sobre 13+
 * faturas por cartão.
 */
export type FaturaComTotal = {
  fatura: Fatura
  mesReferencia: string
  totalCentavos: number
}

export type FaturaApi = {
  listarPorCartao: (cartaoId: number) => Promise<Fatura[]>
  listarResumoPorCartao: (cartaoId: number) => Promise<FaturaComTotal[]>
  detalharComParcelas: (faturaId: number) => Promise<FaturaDetalhada | null>
  fechar: (faturaId: number) => Promise<Fatura>
  pagar: (faturaId: number, dataPagamento: string) => Promise<Fatura>
  reabrir: (faturaId: number) => Promise<Fatura>
}

export { FATURA_IPC_CHANNELS } from './channels'
