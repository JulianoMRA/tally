import { z } from 'zod'
import type { Renda } from '../../domain/entities/renda'
import type { Recebimento } from '../../domain/entities/recebimento'

const dataBRSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((d) => !isNaN(new Date(d).getTime()), 'Data inválida')

const nomeSchema = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(80, 'Nome deve ter no máximo 80 caracteres')

const valorSchema = z
  .number({ message: 'Valor é obrigatório' })
  .int()
  .min(1, 'Valor deve ser maior que zero')

export const criarRendaAvulsaInputSchema = z.object({
  nome: nomeSchema,
  valorPadraoCentavos: valorSchema
})

export type CriarRendaAvulsaInput = z.infer<typeof criarRendaAvulsaInputSchema>

export const criarRendaRecorrenteInputSchema = z.object({
  nome: nomeSchema,
  valorPadraoCentavos: valorSchema,
  diaEsperado: z
    .number({ message: 'Dia esperado é obrigatório' })
    .int()
    .min(1, 'Dia deve ser entre 1 e 31')
    .max(31, 'Dia deve ser entre 1 e 31'),
  dataInicio: dataBRSchema
})

export type CriarRendaRecorrenteInput = z.infer<typeof criarRendaRecorrenteInputSchema>

export const updateRendaInputSchema = z.object({
  nome: nomeSchema,
  valorPadraoCentavos: valorSchema
})

export type UpdateRendaInput = z.infer<typeof updateRendaInputSchema>

export type ListRendaOptions = {
  incluirArquivadas?: boolean
}

export type ResultadoCriarRendaRecorrente = {
  renda: Renda
  recebimentos: Recebimento[]
}

export type RendaApi = {
  list: (options?: ListRendaOptions) => Promise<Renda[]>
  findById: (id: number) => Promise<Renda | null>
  criarAvulsa: (input: CriarRendaAvulsaInput) => Promise<Renda>
  criarRecorrente: (input: CriarRendaRecorrenteInput) => Promise<ResultadoCriarRendaRecorrente>
  update: (id: number, input: UpdateRendaInput) => Promise<Renda>
  arquivar: (id: number) => Promise<Renda>
  desarquivar: (id: number) => Promise<Renda>
}

export const RENDA_IPC_CHANNELS = {
  list: 'renda:list',
  findById: 'renda:findById',
  criarAvulsa: 'renda:criar-avulsa',
  criarRecorrente: 'renda:criar-recorrente',
  update: 'renda:update',
  arquivar: 'renda:arquivar',
  desarquivar: 'renda:desarquivar'
} as const
