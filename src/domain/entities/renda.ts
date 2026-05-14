export type TipoRenda = 'Avulsa' | 'Recorrente'

export type Renda = {
  id: number
  nome: string
  categoriaId: number | null
  tipo: TipoRenda
  valorPadraoCentavos: number
  diaEsperado: number | null
  ativa: boolean
  createdAt: string
  updatedAt: string
}
