import { z } from 'zod'
import type { FormaPagamento, TipoDespesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { BalancoMensal } from '../../domain/services/calcular-balanco-mensal'
import type { RecebimentoComContexto } from './recebimento'

export const detalharMesInputSchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')
})

export type DetalharMesInput = z.infer<typeof detalharMesInputSchema>

export type FaturaResumida = {
  fatura: Fatura
  cartaoNome: string
  cartaoCor: string
  totalCentavos: number
}

/**
 * Uma OCORRENCIA de gasto fora de cartao no mes (RN-08).
 *
 * A unidade deixou de ser a despesa quando a recorrente sem cartao passou a
 * existir (RF-DES-16): uma despesa recorrente tem N ocorrencias em N meses, e a
 * leitura por despesa contaria tudo no mes de inicio e nada nos demais.
 *
 * `id` e da parcela, nao da despesa — e o que mantem a chave unica na lista
 * quando a mesma despesa aparece em meses diferentes.
 */
export type GastoForaCartaoDoMes = {
  id: number
  despesaId: number
  descricao: string
  categoriaId: number
  formaPagamento: FormaPagamento
  tipo: TipoDespesa
  /** Valor DESTA ocorrencia. */
  valorCentavos: number
  /** Data desta ocorrencia (`parcela.data_referencia`). */
  data: string
  /** Numero da ocorrencia dentro da despesa; 1 no gasto unico. */
  numero: number
}

export type VisaoMensalDetalhada = {
  mesReferencia: string
  faturas: FaturaResumida[]
  gastosForaCartao: GastoForaCartaoDoMes[]
  recebimentos: RecebimentoComContexto[]
  totais: BalancoMensal
}

export type VisaoMensalApi = {
  detalhar: (input: DetalharMesInput) => Promise<VisaoMensalDetalhada>
}

export { VISAO_MENSAL_IPC_CHANNELS } from './channels'

export type { BalancoMensal }
