import type { Categoria } from '@domain/entities/categoria'

/**
 * Nome da categoria para uma opção de select. A arquivada leva a marca: numa
 * lista de escolhas, ela não pode passar por uma opção disponível.
 */
export function rotuloDeCategoria(categoria: Pick<Categoria, 'nome' | 'ativo'>): string {
  return categoria.ativo ? categoria.nome : `${categoria.nome} (arquivada)`
}

/**
 * Opções do select de categoria num modal de edição: as ativas e, se estiver
 * arquivada, a atual — por último, como as arquivadas em toda lista (RF-CAT-02).
 *
 * Sem a atual entre as opções, o `<select>` controlado não encontra o valor e
 * mostra a primeira da lista: o que era salvo continuava certo, mas a tela
 * afirmava outra categoria. As outras arquivadas ficam de fora, porque mover
 * uma despesa PARA uma categoria arquivada é justamente o que arquivar impede.
 */
export function categoriasParaEdicao(
  categorias: readonly Categoria[],
  categoriaAtualId: number
): Categoria[] {
  const ativas = categorias.filter((c) => c.ativo)
  const atual = categorias.find((c) => c.id === categoriaAtualId)
  return atual && !atual.ativo ? [...ativas, atual] : ativas
}

function porNome(a: Categoria, b: Categoria): number {
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

/**
 * Ordem das categorias num filtro: ativas em ordem alfabética, arquivadas no
 * fim — a mesma convenção da lista de Categorias (RF-CAT-02). Não altera a
 * lista recebida.
 */
export function ordenarParaFiltro(categorias: readonly Categoria[]): Categoria[] {
  return [
    ...categorias.filter((c) => c.ativo).sort(porNome),
    ...categorias.filter((c) => !c.ativo).sort(porNome)
  ]
}
