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
  /**
   * Dia do mes da cobranca (1..31). Preenchido so na recorrente FORA de cartao
   * (RF-DES-17); `null` em todo o resto.
   *
   * Coluna propria em vez de derivado de `dataCompra` por causa do clamp: "todo
   * dia 31" comecando em fevereiro gravaria 28 na primeira ocorrencia, e a
   * serie inteira herdaria o 28 dai em diante. O clamp nao tem volta.
   */
  diaCobranca: number | null
  /** Data limite da recorrencia (RF-DES-18); `null` = recorre sempre, ate cancelar. */
  recorreAte: string | null
  nota: string | null
  ativa: boolean
  createdAt: string
  updatedAt: string
}
