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

import type { CartaoApi } from './cartao'
import type { CategoriaApi } from './categoria'
import type { DespesaApi } from './despesa'
import type { FaturaApi } from './fatura'

export type Api = {
  cartao: CartaoApi
  categoria: CategoriaApi
  despesa: DespesaApi
  fatura: FaturaApi
}
