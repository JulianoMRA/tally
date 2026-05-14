export {
  cartaoInputSchema,
  corHexSchema,
  CARTAO_IPC_CHANNELS,
  type CartaoInput,
  type ListCartaoOptions,
  type CartaoApi
} from './cartao'

import type { CartaoApi } from './cartao'

export type Api = {
  cartao: CartaoApi
}
