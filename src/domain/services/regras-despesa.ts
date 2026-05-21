import type { Parcela } from '../entities/parcela'

export type PodeDeletarDespesaResult =
  | { ok: true }
  | { ok: false; motivo: 'has-parcela-paga'; parcelasPagas: number[] }

/**
 * RF-DES-09 — regra pura de elegibilidade para exclusão de despesa.
 *
 * Despesa pode ser excluída se nenhuma de suas parcelas estiver paga.
 * Caso contrário, retorna a lista de números de parcelas pagas para a UI
 * conseguir comunicar o motivo do bloqueio.
 */
export function podeDeletarDespesa(parcelas: readonly Parcela[]): PodeDeletarDespesaResult {
  const pagas = parcelas.filter((p) => p.status === 'Paga').map((p) => p.numero)
  if (pagas.length > 0) {
    return { ok: false, motivo: 'has-parcela-paga', parcelasPagas: pagas }
  }
  return { ok: true }
}
