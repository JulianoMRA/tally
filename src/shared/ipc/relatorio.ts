import { z } from 'zod'

const mesReferenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês deve estar no formato YYYY-MM')

const mesesSchema = z.union([z.literal(6), z.literal(12)])

export const totaisPorCategoriaInputSchema = z.object({
  mesReferencia: mesReferenciaSchema
})

export type TotaisPorCategoriaInput = z.infer<typeof totaisPorCategoriaInputSchema>

export const evolucaoSaldoInputSchema = z.object({
  mesFinal: mesReferenciaSchema,
  meses: mesesSchema
})

export type EvolucaoSaldoInput = z.infer<typeof evolucaoSaldoInputSchema>

export const evolucaoCategoriaInputSchema = z.object({
  categoriaId: z.number().int().positive(),
  mesFinal: mesReferenciaSchema,
  meses: mesesSchema
})

export type EvolucaoCategoriaInput = z.infer<typeof evolucaoCategoriaInputSchema>

export type TotalPorCategoria = {
  categoriaId: number
  categoriaNome: string
  cor: string
  totalCentavos: number
}

export type PontoEvolucaoSaldo = {
  mes: string
  entradasCentavos: number
  saidasCentavos: number
  saldoCentavos: number
}

export type PontoEvolucaoCategoria = {
  mes: string
  totalCentavos: number
}

export type RelatorioApi = {
  totaisPorCategoria: (input: TotaisPorCategoriaInput) => Promise<TotalPorCategoria[]>
  evolucaoSaldo: (input: EvolucaoSaldoInput) => Promise<PontoEvolucaoSaldo[]>
  evolucaoCategoria: (input: EvolucaoCategoriaInput) => Promise<PontoEvolucaoCategoria[]>
}

export const RELATORIO_IPC_CHANNELS = {
  totaisPorCategoria: 'relatorio:totaisPorCategoria',
  evolucaoSaldo: 'relatorio:evolucaoSaldo',
  evolucaoCategoria: 'relatorio:evolucaoCategoria'
} as const
