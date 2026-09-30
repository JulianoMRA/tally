import type { FaturaComTotal } from '@shared/ipc/fatura'

/**
 * Abas do Histórico. Eram os três status do ciclo de vida, e "Abertas" quase
 * nunca tinha item — mas podia ter: a fatura nasce Aberta e só fecha quando a
 * manutenção roda. "A pagar" junta Aberta e Fechada e responde a pergunta que
 * o filtro existe para responder: o que ficou para trás sem pagar.
 */
export type FiltroStatus = 'todas' | 'a-pagar' | 'pagas'

/*
 * Helpers do Histórico de faturas, puros para ficarem testáveis sem montar a
 * tela.
 */

export function filtrarPorStatus(
  faturas: readonly FaturaComTotal[],
  filtro: FiltroStatus
): FaturaComTotal[] {
  if (filtro === 'todas') return [...faturas]
  const querPagas = filtro === 'pagas'
  return faturas.filter((f) => (f.fatura.status.kind === 'Paga') === querPagas)
}

/** Quantas faturas cada aba mostraria. As duas últimas somam a primeira. */
export function contarPorStatus(faturas: readonly FaturaComTotal[]): Record<FiltroStatus, number> {
  const pagas = faturas.filter((f) => f.fatura.status.kind === 'Paga').length
  return { todas: faturas.length, 'a-pagar': faturas.length - pagas, pagas }
}

/** Soma dos totais, para o resumo no cabeçalho do cartão. */
export function somarTotais(faturas: readonly FaturaComTotal[]): number {
  return faturas.reduce((soma, f) => soma + f.totalCentavos, 0)
}
