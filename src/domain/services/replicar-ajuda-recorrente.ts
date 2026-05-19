import type { Parcela } from '../entities/parcela'
import type { Fatura } from '../entities/fatura'

/**
 * RN-05 — seleciona parcelas futuras da mesma despesa que devem receber
 * uma cópia da ajuda recorrente recém-criada.
 *
 * Critério: numero > origem.numero, com faturaId não nulo, e fatura no estado Aberta.
 * Parcelas em fatura Fechada ou Paga preservam o histórico financeiro e não
 * recebem a réplica.
 */
export function selecionarParcelasParaReplicarAjuda(
  parcelas: Parcela[],
  faturasIndex: Map<number, Fatura>,
  origem: Parcela
): Parcela[] {
  return parcelas
    .filter((p) => {
      if (p.id === origem.id) return false
      if (p.numero <= origem.numero) return false
      if (p.faturaId === null) return false
      const fat = faturasIndex.get(p.faturaId)
      if (!fat) return false
      return fat.status.kind === 'Aberta'
    })
    .sort((a, b) => a.numero - b.numero)
}
