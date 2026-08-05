import type { FaturaComTotal } from '@shared/ipc/fatura'

export type FiltroStatus = 'todas' | 'Aberta' | 'Fechada' | 'Paga'

/**
 * A visão geral despejava todas as faturas do cartão em ordem cronológica,
 * começando pela mais antiga — 13 itens por cartão, com o mês atual perdido no
 * meio. Estes helpers separam o que já passou do que interessa agora.
 *
 * Puros, para ficarem testáveis sem montar a tela.
 */

export function filtrarPorStatus(
  faturas: readonly FaturaComTotal[],
  filtro: FiltroStatus
): FaturaComTotal[] {
  if (filtro === 'todas') return [...faturas]
  return faturas.filter((f) => f.fatura.status.kind === filtro)
}

/**
 * Divide entre meses anteriores ao atual e o resto. O mês atual entra em
 * `correntes`: é o que o usuário quer ver ao abrir a tela.
 */
export function particionarPorMes(
  faturas: readonly FaturaComTotal[],
  mesAtual: string
): { anteriores: FaturaComTotal[]; correntes: FaturaComTotal[] } {
  const anteriores: FaturaComTotal[] = []
  const correntes: FaturaComTotal[] = []
  for (const f of faturas) {
    if (f.mesReferencia < mesAtual) anteriores.push(f)
    else correntes.push(f)
  }
  return { anteriores, correntes }
}

/** Soma dos totais, para o resumo no cabeçalho do cartão. */
export function somarTotais(faturas: readonly FaturaComTotal[]): number {
  return faturas.reduce((soma, f) => soma + f.totalCentavos, 0)
}
