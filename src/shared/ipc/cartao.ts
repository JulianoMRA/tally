import { z } from 'zod'
import type { Cartao } from '../../domain/entities/cartao'

export const corHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar no formato #RRGGBB')

export const cartaoInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(60, 'Nome deve ter no máximo 60 caracteres'),
  diaFechamento: z
    .number({ message: 'Dia de fechamento deve ser um número' })
    .int('Dia de fechamento deve ser inteiro')
    .min(1, 'Dia de fechamento deve ser entre 1 e 31')
    .max(31, 'Dia de fechamento deve ser entre 1 e 31'),
  diaVencimento: z
    .number({ message: 'Dia de vencimento deve ser um número' })
    .int('Dia de vencimento deve ser inteiro')
    .min(1, 'Dia de vencimento deve ser entre 1 e 31')
    .max(31, 'Dia de vencimento deve ser entre 1 e 31'),
  cor: corHexSchema
})

export type CartaoInput = z.infer<typeof cartaoInputSchema>

export const cartaoIdSchema = z.number().int().positive()

export const listCartaoOptionsSchema = z
  .object({
    incluirArquivados: z.boolean().optional()
  })
  .optional()

export type ListCartaoOptions = z.infer<typeof listCartaoOptionsSchema>

export const updateCartaoInputSchema = z.object({
  id: cartaoIdSchema,
  data: cartaoInputSchema
})

export type CartaoApi = {
  list: (options?: ListCartaoOptions) => Promise<Cartao[]>
  findById: (id: number) => Promise<Cartao | null>
  create: (input: CartaoInput) => Promise<Cartao>
  update: (id: number, input: CartaoInput) => Promise<Cartao>
  arquivar: (id: number) => Promise<Cartao>
  desarquivar: (id: number) => Promise<Cartao>
}

export { CARTAO_IPC_CHANNELS } from './channels'
