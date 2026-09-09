/**
 * Categoria de despesa.
 *
 * Não tem `tipo` desde a migration 0014. A coluna separava categorias de
 * despesa das de renda, mas o Slice 12.1 removeu `renda.categoria_id` e renda
 * deixou de ter categoria — os três chamadores no app pediam 'Despesa' e
 * ninguém jamais pedia 'Renda'. O formulário ainda oferecia as duas opções, e
 * uma categoria criada como 'Renda' era inalcançável em todo o app.
 */
export type Categoria = {
  id: number
  nome: string
  cor: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}
