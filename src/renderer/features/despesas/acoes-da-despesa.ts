import type { TipoDespesa } from '@domain/entities/despesa'
import type { StatusFatura } from '@domain/entities/fatura'
import type { StatusParcela } from '@domain/entities/parcela'
import type { MotivoBloqueioExclusao } from '@domain/services/regras-despesa'

/**
 * As regras da linha de uma despesa que Saídas e Faturas dizem igual: por que
 * Excluir está bloqueado e por que valor e data não mudam. O diálogo de
 * exclusão, que também é o mesmo nas duas telas, mora em `DialogoExcluirDespesa`.
 * Moravam no `FaturaDetalhe`, e Saídas oferecia Excluir em toda linha e deixava
 * editar o que a gravação recusaria.
 */

/**
 * Por que Excluir está desabilitado nesta linha, ou null quando não está
 * (RF-DES-09). O bloqueio vem do main, que olha todas as parcelas da despesa;
 * a linha só conhece a dela. Sem isso a tela oferecia Excluir onde ele sempre
 * falharia, depois do diálogo "irreversível".
 */
export function motivoDoBloqueioDeExclusao(
  statusParcela: StatusParcela,
  bloqueio: MotivoBloqueioExclusao | undefined
): string | null {
  if (statusParcela === 'Paga' || bloqueio === 'has-parcela-paga') {
    return 'Não dá para excluir: a despesa tem parcela paga.'
  }
  if (bloqueio === 'has-parcela-em-fatura-fechada') {
    return 'Não dá para excluir: a despesa tem parcela em fatura fechada ou paga.'
  }
  return null
}

/**
 * Por que valor e data da compra não mudam mais, ou undefined quando mudam
 * (RF-DES-10): compra à vista cuja fatura não está Aberta. Com o motivo, o modal
 * de edição trava os dois campos e diz por quê; sem ele, deixava editar e a
 * gravação era recusada. A parcelada tem regra própria — a data nunca muda, e o
 * valor novo vale só para as parcelas em fatura aberta —, e fora de fatura não
 * há o que travar.
 */
export function travaDeValorEData(
  tipo: TipoDespesa,
  statusFatura: StatusFatura['kind'] | undefined
): string | undefined {
  if (tipo !== 'Unica' || statusFatura === undefined || statusFatura === 'Aberta') return undefined
  return 'A fatura desta compra está fechada: valor e data não mudam mais.'
}
