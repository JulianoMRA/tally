export type StatusFatura =
  | { kind: 'Aberta' }
  | { kind: 'Fechada' }
  | { kind: 'Paga'; pagaEm: string }

export type Fatura = {
  id: number
  cartaoId: number
  mesReferencia: string
  dataFechamento: string
  dataVencimento: string
  status: StatusFatura
  createdAt: string
  updatedAt: string
}
