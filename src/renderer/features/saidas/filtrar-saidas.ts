import type { Despesa } from '@domain/entities/despesa'

const DIACRITICOS = /[̀-ͯ]/g

/** Remove acentos e caixa para busca tolerante (café ≈ cafe ≈ CAFE). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().trim()
}

/**
 * Filtra despesas por trecho da descrição, ignorando acentos e caixa.
 * Busca vazia (ou só espaços) devolve a lista inalterada. Função pura.
 */
export function filtrarPorDescricao<T extends Pick<Despesa, 'descricao'>>(
  itens: readonly T[],
  busca: string
): T[] {
  const alvo = normalizar(busca)
  if (alvo.length === 0) return [...itens]
  return itens.filter((item) => normalizar(item.descricao).includes(alvo))
}
