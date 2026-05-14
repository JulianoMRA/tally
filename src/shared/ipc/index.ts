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

import type { CartaoApi } from './cartao'
import type { CategoriaApi } from './categoria'

export type Api = {
  cartao: CartaoApi
  categoria: CategoriaApi
}
