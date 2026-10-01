import { z } from 'zod'
import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { PagamentoParcial } from '../../domain/entities/pagamento-parcial'
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

/**
 * RN-10 — registrar pagamento parcial.
 *
 * O schema garante o que não depende do banco: valor inteiro de pelo menos um
 * centavo e data que existe no calendário. O teto do valor (não passar do que
 * falta pagar) e o status da fatura dependem do estado gravado, e ficam com
 * `podeRegistrarPagamentoParcial`, no domínio.
 */
export const registrarPagamentoParcialInputSchema = z.object({
  faturaId: idSchema,
  valorCentavos: z
    .number({ message: 'Valor é obrigatório' })
    .int()
    .min(1, 'Valor deve ser maior que zero'),
  dataPagamento: dataIsoSchema
})

export type RegistrarPagamentoParcialInput = z.infer<typeof registrarPagamentoParcialInputSchema>

export const excluirPagamentoParcialInputSchema = z.object({
  pagamentoId: idSchema
})

export type ExcluirPagamentoParcialInput = z.infer<typeof excluirPagamentoParcialInputSchema>

export type FaturaDetalhada = {
  fatura: Fatura
  parcelas: Parcela[]
  /** Soma das parcelas (RN-07): quanto foi comprado. Não muda com pagamento. */
  totalCentavos: number
  /** RN-10 — soma dos pagamentos parciais da fatura. */
  pagoParcialCentavos: number
  /** RN-10 — o que falta pagar: total menos os pagamentos parciais, nunca negativo. */
  restanteCentavos: number
  /**
   * RN-10 — o que os pagamentos parciais passam do total. Só fica acima de
   * zero numa fatura Aberta cuja despesa foi excluída ou reduzida depois do
   * pagamento.
   */
  excedenteCentavos: number
  /** RN-10 — os pagamentos parciais, por data e, no mesmo dia, por ordem de registro. */
  pagamentosParciais: PagamentoParcial[]
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
 *
 * Os dois campos do RN-10 são obrigatórios, e não opcionais como os campos
 * que o detalhe ganhou depois: dinheiro opcional vira `?? 0` espalhado pela
 * tela, e zero por omissão é o tipo de erro que não aparece.
 */
export type FaturaComTotal = {
  fatura: Fatura
  mesReferencia: string
  totalCentavos: number
  /** RN-10 — soma dos pagamentos parciais da fatura. */
  pagoParcialCentavos: number
  /** RN-10 — o que falta pagar: total menos os pagamentos parciais, nunca negativo. */
  restanteCentavos: number
}

export type FaturaApi = {
  listarPorCartao: (cartaoId: number) => Promise<Fatura[]>
  listarResumoPorCartao: (cartaoId: number) => Promise<FaturaComTotal[]>
  detalharComParcelas: (faturaId: number) => Promise<FaturaDetalhada | null>
  fechar: (faturaId: number) => Promise<Fatura>
  pagar: (faturaId: number, dataPagamento: string) => Promise<Fatura>
  reabrir: (faturaId: number) => Promise<Fatura>
  registrarPagamentoParcial: (input: RegistrarPagamentoParcialInput) => Promise<PagamentoParcial>
  excluirPagamentoParcial: (input: ExcluirPagamentoParcialInput) => Promise<void>
}

export { FATURA_IPC_CHANNELS } from './channels'
