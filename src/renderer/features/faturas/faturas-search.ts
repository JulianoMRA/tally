export type FaturasSearch = {
  cartaoId: number | null
  faturaId: number | null
}

function parseIdPositivo(valor: string | null): number | null {
  if (valor === null) return null
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

/**
 * Lê os parâmetros de deep-link da tela de Faturas (#/faturas?cartaoId=&faturaId=).
 * Apenas inteiros positivos são aceitos; qualquer outro valor vira null.
 */
export function parseFaturasSearch(params: URLSearchParams): FaturasSearch {
  return {
    cartaoId: parseIdPositivo(params.get('cartaoId')),
    faturaId: parseIdPositivo(params.get('faturaId'))
  }
}

/**
 * Monta a query string que abre uma fatura específica direto no detalhe.
 */
export function buildFaturasSearch(cartaoId: number, faturaId: number): string {
  return `cartaoId=${cartaoId}&faturaId=${faturaId}`
}
