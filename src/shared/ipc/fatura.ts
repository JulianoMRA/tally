import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'

export type FaturaDetalhada = {
  fatura: Fatura
  parcelas: Parcela[]
  totalBrutoCentavos: number
}

export type FaturaApi = {
  listarPorCartao: (cartaoId: number) => Promise<Fatura[]>
  detalharComParcelas: (faturaId: number) => Promise<FaturaDetalhada | null>
}

export const FATURA_IPC_CHANNELS = {
  listarPorCartao: 'fatura:listarPorCartao',
  detalharComParcelas: 'fatura:detalharComParcelas'
} as const
