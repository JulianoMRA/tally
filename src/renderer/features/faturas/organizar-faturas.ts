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

/**
 * Quanto falta pagar nas faturas da lista (RN-10), para a barra do Histórico:
 * a soma do restante das que não estão pagas.
 *
 * A barra somava o restante de todas, num número sem rótulo. Na fatura paga o
 * restante é o que foi quitado ao marcar como paga, e não o que falta: em
 * "Todas" a conta juntava as duas grandezas, e nada na tela dizia qual era.
 */
export function somarAPagar(faturas: readonly FaturaComTotal[]): number {
  return faturas
    .filter((f) => f.fatura.status.kind !== 'Paga')
    .reduce((soma, f) => soma + f.restanteCentavos, 0)
}
