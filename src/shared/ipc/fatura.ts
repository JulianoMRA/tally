import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'

export type FaturaDetalhada = {
  fatura: Fatura
  parcelas: Parcela[]
  totalBrutoCentavos: number
  totalAjudasCentavos: number
  totalLiquidoCentavos: number
}

export type FaturaApi = {
  listarPorCartao: (cartaoId: number) => Promise<Fatura[]>
  detalharComParcelas: (faturaId: number) => Promise<FaturaDetalhada | null>
  fechar: (faturaId: number) => Promise<Fatura>
  pagar: (faturaId: number, dataPagamento: string) => Promise<Fatura>
  reabrir: (faturaId: number) => Promise<Fatura>
}

export const FATURA_IPC_CHANNELS = {
  listarPorCartao: 'fatura:listarPorCartao',
  detalharComParcelas: 'fatura:detalharComParcelas',
  fechar: 'fatura:fechar',
  pagar: 'fatura:pagar',
  reabrir: 'fatura:reabrir'
} as const
