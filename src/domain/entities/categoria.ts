export type TipoCategoria = 'Despesa' | 'Renda' | 'Ambos'

export type Categoria = {
  id: number
  nome: string
  tipo: TipoCategoria
  cor: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}
