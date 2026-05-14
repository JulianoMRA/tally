export type StatusParcela = 'Pendente' | 'Paga'

export type Parcela = {
  id: number
  despesaId: number
  faturaId: number | null
  numero: number
  total: number | null
  valorCentavos: number
  dataReferencia: string
  status: StatusParcela
  dataPagamento: string | null
  createdAt: string
  updatedAt: string
}
