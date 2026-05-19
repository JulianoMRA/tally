import { z } from 'zod'
import type { Contribuidor } from '../../domain/entities/contribuidor'

export const contribuidorInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(60, 'Nome deve ter no máximo 60 caracteres'),
  contato: z
    .string()
    .trim()
    .max(60, 'Contato deve ter no máximo 60 caracteres')
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
})

export type ContribuidorInput = z.infer<typeof contribuidorInputSchema>

export type ListContribuidorOptions = {
  incluirArquivados?: boolean
}

export type ContribuidorApi = {
  list: (options?: ListContribuidorOptions) => Promise<Contribuidor[]>
  findById: (id: number) => Promise<Contribuidor | null>
  create: (input: ContribuidorInput) => Promise<Contribuidor>
  update: (id: number, input: ContribuidorInput) => Promise<Contribuidor>
  arquivar: (id: number) => Promise<Contribuidor>
  desarquivar: (id: number) => Promise<Contribuidor>
}

export const CONTRIBUIDOR_IPC_CHANNELS = {
  list: 'contribuidor:list',
  findById: 'contribuidor:findById',
  create: 'contribuidor:create',
  update: 'contribuidor:update',
  arquivar: 'contribuidor:arquivar',
  desarquivar: 'contribuidor:desarquivar'
} as const
