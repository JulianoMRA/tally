export type TipoCategoria = 'Despesa' | 'Renda' | 'Ambos'

export type Categoria = {
  id: number
  nome: string
  tipo: TipoCategoria
  cor: string
  icone: string | null
  ativo: boolean
  createdAt: string
  updatedAt: string
}
