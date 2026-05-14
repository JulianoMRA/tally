export type StatusAjuda = 'Pendente' | 'Recebida'

export type Ajuda = {
  id: number
  contribuidorId: number
  parcelaId: number
  valorCentavos: number
  status: StatusAjuda
  dataRecebimento: string | null
  recorrente: boolean
  createdAt: string
  updatedAt: string
}
