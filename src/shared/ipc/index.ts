export {
  cartaoInputSchema,
  corHexSchema,
  CARTAO_IPC_CHANNELS,
  type CartaoInput,
  type ListCartaoOptions,
  type CartaoApi
} from './cartao'

export {
  categoriaInputSchema,
  CATEGORIA_IPC_CHANNELS,
  type CategoriaInput,
  type ListCategoriaOptions,
  type CategoriaApi
} from './categoria'

export {
  despesaUnicaCreditoInputSchema,
  DESPESA_IPC_CHANNELS,
  type DespesaUnicaCreditoInput,
  type ResultadoCriarDespesa,
  type DespesaApi
} from './despesa'

export { FATURA_IPC_CHANNELS, type FaturaDetalhada, type FaturaApi } from './fatura'

export {
  RENDA_IPC_CHANNELS,
  type CriarRendaAvulsaInput,
  type CriarRendaRecorrenteInput,
  type UpdateRendaInput,
  type ListRendaOptions,
  type RendaApi
} from './renda'

export {
  RECEBIMENTO_IPC_CHANNELS,
  type CriarRecebimentoAvulsoInput,
  type MarcarRecebidoInput,
  type ExcluirRecebimentoInput,
  type ListarRecebimentosInput,
  type RecebimentoComContexto,
  type RecebimentoApi
} from './recebimento'

export {
  VISAO_MENSAL_IPC_CHANNELS,
  type DetalharMesInput,
  type FaturaResumida,
  type VisaoMensalDetalhada,
  type VisaoMensalApi
} from './visao-mensal'

import type { CartaoApi } from './cartao'
import type { CategoriaApi } from './categoria'
import type { DespesaApi } from './despesa'
import type { FaturaApi } from './fatura'
import type { RendaApi } from './renda'
import type { RecebimentoApi } from './recebimento'
import type { VisaoMensalApi } from './visao-mensal'

export type Api = {
  cartao: CartaoApi
  categoria: CategoriaApi
  despesa: DespesaApi
  fatura: FaturaApi
  renda: RendaApi
  recebimento: RecebimentoApi
  visaoMensal: VisaoMensalApi
}
