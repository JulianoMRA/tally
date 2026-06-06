import { z } from 'zod'
import { corHexSchema } from './cartao'
import type { Categoria, TipoCategoria } from '../../domain/entities/categoria'

export const categoriaInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(60, 'Nome deve ter no máximo 60 caracteres'),
  tipo: z.enum(['Despesa', 'Renda', 'Ambos'], { message: 'Tipo inválido' }),
  cor: corHexSchema
})

export type CategoriaInput = z.infer<typeof categoriaInputSchema>

export const categoriaIdSchema = z.number().int().positive()

export const listCategoriaOptionsSchema = z
  .object({
    incluirArquivados: z.boolean().optional(),
    tipo: z.enum(['Despesa', 'Renda', 'Ambos']).optional()
  })
  .optional()

export type ListCategoriaOptions = {
  incluirArquivados?: boolean
  tipo?: TipoCategoria
}

export type CategoriaApi = {
  list: (options?: ListCategoriaOptions) => Promise<Categoria[]>
  findById: (id: number) => Promise<Categoria | null>
  create: (input: CategoriaInput) => Promise<Categoria>
  update: (id: number, input: CategoriaInput) => Promise<Categoria>
  arquivar: (id: number) => Promise<Categoria>
  desarquivar: (id: number) => Promise<Categoria>
}

export { CATEGORIA_IPC_CHANNELS } from './channels'
