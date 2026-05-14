export type StatusRecebimento = 'Esperado' | 'Recebido'

export type Recebimento = {
  id: number
  rendaId: number | null
  valorCentavos: number
  dataEsperada: string
  dataRecebida: string | null
  status: StatusRecebimento
  createdAt: string
  updatedAt: string
}
