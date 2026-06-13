export type Comparador<T> = (a: T, b: T) => number

/**
 * Comparador alfabético pt-BR (case e acento-insensível via localeCompare).
 * Valores null/undefined viram string vazia — caem no início em ordem asc.
 */
export function alfabetico<T>(get: (item: T) => string | null | undefined): Comparador<T> {
  return (a, b) => (get(a) ?? '').localeCompare(get(b) ?? '', 'pt-BR')
}

/**
 * Comparador de datas ISO (YYYY-MM-DD). A comparação lexicográfica de string
 * coincide com a cronológica nesse formato. Ausentes viram string vazia.
 */
export function porData<T>(get: (item: T) => string | null | undefined): Comparador<T> {
  return (a, b) => (get(a) ?? '').localeCompare(get(b) ?? '')
}

/** Comparador numérico crescente. */
export function porNumero<T>(get: (item: T) => number): Comparador<T> {
  return (a, b) => get(a) - get(b)
}
