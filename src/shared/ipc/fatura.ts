import type { Despesa } from '../../domain/entities/despesa'
import type { Fatura } from '../../domain/entities/fatura'
import type { Parcela } from '../../domain/entities/parcela'

export type FaturaDetalhada = {
  fatura: Fatura
  parcelas: Parcela[]
  totalCentavos: number
  /**
   * Mapa parcelaId → despesa associada. Permite exibir descrição na tabela
   * e pré-popular o EditarDespesaModal sem round-trip extra. Slice 14.1.
   */
  despesasPorParcela?: Record<number, Despesa>
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
