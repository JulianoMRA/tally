import { useMemo, useState } from 'react'
import type { Comparador } from './comparadores'

export type Direcao = 'asc' | 'desc'

/**
 * Ordena uma cópia de `itens` aplicando o sinal da direção sobre o comparador.
 * Não muta o array original; o sort do V8 é estável, preservando a ordem de
 * entrada em empates.
 */
export function ordenarPor<T>(itens: readonly T[], comparador: Comparador<T>, dir: Direcao): T[] {
  const copia = [...itens]
  copia.sort((a, b) => {
    const c = comparador(a, b)
    return dir === 'asc' ? c : -c
  })
  return copia
}

/**
 * Estado de ordenação clicável para tabelas. Replica o padrão de FaturaDetalhe:
 * clicar na coluna ativa alterna asc/desc; trocar de coluna reseta para asc.
 */
export function useOrdenacao<T, C extends Record<string, Comparador<T>>>(
  itens: readonly T[],
  comparadores: C,
  chaveInicial: keyof C & string,
  direcaoInicial: Direcao = 'asc'
) {
  type Chave = keyof C & string
  const [sortBy, setSortBy] = useState<Chave>(chaveInicial)
  const [sortDir, setSortDir] = useState<Direcao>(direcaoInicial)

  const itensOrdenados = useMemo(
    () => ordenarPor(itens, comparadores[sortBy], sortDir),
    [itens, comparadores, sortBy, sortDir]
  )

  function handleSort(col: Chave): void {
    if (col === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  function sortIndicator(col: Chave): string {
    if (col !== sortBy) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return { itensOrdenados, sortBy, sortDir, handleSort, sortIndicator }
}
