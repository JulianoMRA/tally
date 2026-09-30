import type { FaturaComTotal } from '@shared/ipc/fatura'
import { mesReferenciaAnterior } from '@domain/services/mes-referencia'

/**
 * A fatura que o card do trilho mostra e que o painel abre sem clique
 * (RF-FAT-06): entre as não pagas e com valor, do mês anterior em diante, a de
 * vencimento mais próximo — inclusive vencida. Sem nenhuma, a mais recente.
 *
 * Até set/2026 a preferência era o mês de referência atual, e isso falhava no
 * cartão que vence no mês seguinte ao fechamento (fecha 24, vence 01): a
 * fatura de setembro vence em 01/10, e no dia 01 o card trocava pela de
 * outubro, Aberta, justo no dia de pagar a anterior. A mesma regra mantinha no
 * card uma fatura já paga enquanto a próxima acumulava fora dele.
 *
 * A janela começa no mês anterior porque é até onde vai a fatura que pode
 * vencer no mês atual. Sem ela, quem importou histórico ou não marca as
 * faturas como pagas veria no card a mais antiga do cartão; essas dívidas
 * ficam no Histórico, contadas em "A pagar".
 */
export function escolherFaturaCorrente(
  faturas: readonly FaturaComTotal[],
  mesAtual: string
): FaturaComTotal | null {
  const inicioDaJanela = mesReferenciaAnterior(mesAtual)

  // `[...]` antes de ordenar: a lista vem do hook e é reusada pelo trilho.
  const aPagar = faturas
    .filter(
      (f) =>
        f.fatura.status.kind !== 'Paga' && f.totalCentavos > 0 && f.mesReferencia >= inicioDaJanela
    )
    .sort(
      (a, b) =>
        a.fatura.dataVencimento.localeCompare(b.fatura.dataVencimento) ||
        a.mesReferencia.localeCompare(b.mesReferencia)
    )
  if (aPagar[0]) return aPagar[0]

  const recentes = [...faturas].sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia))
  return recentes[0] ?? null
}

export type ResolucaoDeepLink = {
  fatura: FaturaComTotal | null
  /** True quando a URL pedia uma fatura que não existe mais. */
  linkQuebrado: boolean
}

/**
 * Decide qual fatura abrir a partir do `?faturaId=` da URL.
 *
 * Com a fusão de lista e detalhe não existe mais um estado "nenhuma fatura
 * aberta" para onde cair, então link morto abre a fatura corrente e sinaliza —
 * em vez de deixar a tela num beco com botão "Voltar", que era o que fazia
 * sentido quando havia uma lista atrás.
 */
export function resolverFaturaDoDeepLink(
  faturas: readonly FaturaComTotal[],
  faturaIdPedida: number | null,
  mesAtual: string
): ResolucaoDeepLink {
  if (faturaIdPedida === null) {
    return { fatura: escolherFaturaCorrente(faturas, mesAtual), linkQuebrado: false }
  }

  const pedida = faturas.find((f) => f.fatura.id === faturaIdPedida)
  if (pedida) return { fatura: pedida, linkQuebrado: false }

  return { fatura: escolherFaturaCorrente(faturas, mesAtual), linkQuebrado: true }
}
