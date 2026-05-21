export type ItemPorCategoria = {
  categoriaId: number
  valorCentavos: number
}

export type TotalPorCategoria = {
  categoriaId: number
  totalCentavos: number
}

/**
 * Soma `valorCentavos` agrupando por `categoriaId` e devolve a lista
 * ordenada por total decrescente. Função pura, sem I/O.
 */
export function agregarPorCategoria(itens: readonly ItemPorCategoria[]): TotalPorCategoria[] {
  const mapa = new Map<number, number>()
  for (const item of itens) {
    mapa.set(item.categoriaId, (mapa.get(item.categoriaId) ?? 0) + item.valorCentavos)
  }
  return [...mapa.entries()]
    .map(([categoriaId, totalCentavos]) => ({ categoriaId, totalCentavos }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos)
}
