export type TipoDespesa = 'Unica' | 'Parcelada' | 'Assinatura'
export type FormaPagamento = 'Credito' | 'Debito' | 'Pix' | 'Dinheiro'

export type Despesa = {
  id: number
  descricao: string
  categoriaId: number
  tipo: TipoDespesa
  formaPagamento: FormaPagamento
  cartaoId: number | null
  valorCentavos: number
  totalParcelas: number | null
  dataCompra: string
  nota: string | null
  ativa: boolean
  createdAt: string
  updatedAt: string
}
