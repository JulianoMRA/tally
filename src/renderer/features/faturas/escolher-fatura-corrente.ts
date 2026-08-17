import type { FaturaComTotal } from '@shared/ipc/fatura'

/**
 * A fatura que a tela abre por padrão para um cartão.
 *
 * Responde o ponto 12 do diagnóstico: hoje são três cliques até a fatura atual
 * (select de cartão → lista agrupada → item). Com lista e detalhe fundidos, o
 * padrão precisa ser bom o bastante para valer zero clique.
 *
 * A preferência é o mês corrente. Cartão sem compra no mês não tem fatura do
 * mês, e aí o que interessa é a próxima a vencer — não a mais antiga esquecida
 * atrás. Só quando não há nada à frente é que se olha para trás.
 */
export function escolherFaturaCorrente(
  faturas: readonly FaturaComTotal[],
  mesAtual: string
): FaturaComTotal | null {
  if (faturas.length === 0) return null

  const doMes = faturas.find((f) => f.mesReferencia === mesAtual)
  if (doMes) return doMes

  // `[...]` antes de ordenar: a lista vem do hook e é reusada pelo trilho.
  const futuras = [...faturas]
    .filter((f) => f.mesReferencia > mesAtual)
    .sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia))
  if (futuras[0]) return futuras[0]

  const passadas = [...faturas]
    .filter((f) => f.mesReferencia < mesAtual)
    .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia))
  return passadas[0] ?? null
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
