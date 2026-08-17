import type { DespesaComTags } from '@shared/ipc/despesa'

export type GrupoDia = {
  /** Data ISO do grupo, `YYYY-MM-DD`. */
  data: string
  itens: DespesaComTags[]
  totalCentavos: number
}

/**
 * Quebra a lista de saídas em grupos de um dia, preservando a ordem recebida.
 *
 * Responde o ponto 11 do diagnóstico: a lista era um bloco contínuo de
 * lançamentos, sem ritmo e sem soma. O subtotal do grupo responde "quanto saiu
 * naquele dia" sem abrir nada.
 *
 * Preserva a ordem em vez de reordenar: quem ordena é o `useOrdenacao`, e
 * reagrupar por conta própria brigaria com a direção escolhida na coluna Data.
 * Datas iguais não adjacentes viram grupos separados — é o sintoma correto de
 * uma lista ordenada por outra coluna, e por isso a página só agrupa quando a
 * ordenação é por data.
 */
export function agruparPorDia(itens: readonly DespesaComTags[]): GrupoDia[] {
  const grupos: GrupoDia[] = []

  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.data === item.dataCompra) {
      ultimo.itens.push(item)
      ultimo.totalCentavos += item.valorCentavos
      continue
    }
    grupos.push({ data: item.dataCompra, itens: [item], totalCentavos: item.valorCentavos })
  }

  return grupos
}
