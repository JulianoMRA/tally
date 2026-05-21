export type TipoRenda = 'Avulsa' | 'Recorrente'

export type Renda = {
  id: number
  nome: string
  tipo: TipoRenda
  valorPadraoCentavos: number
  diaEsperado: number | null
  ativa: boolean
  createdAt: string
  updatedAt: string
}
