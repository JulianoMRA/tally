import { z } from 'zod'
import type { Despesa } from '../../domain/entities/despesa'
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
  totalBrutoCentavos: number
  totalAjudasCentavos: number
  totalLiquidoCentavos: number
}

export type AjudaPendentePorContribuidor = {
  contribuidorId: number
  contribuidorNome: string
  totalPendenteCentavos: number
}

export type VisaoMensalDetalhada = {
  mesReferencia: string
  faturas: FaturaResumida[]
  gastosForaCartao: Despesa[]
  recebimentos: RecebimentoComContexto[]
  ajudasPendentes: AjudaPendentePorContribuidor[]
  totais: BalancoMensal
}

export type VisaoMensalApi = {
  detalhar: (input: DetalharMesInput) => Promise<VisaoMensalDetalhada>
}

export const VISAO_MENSAL_IPC_CHANNELS = {
  detalhar: 'visao-mensal:detalhar'
} as const

export type { BalancoMensal }
