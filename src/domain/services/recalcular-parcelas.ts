import type { Parcela } from '../entities/parcela'

/**
 * RF-DES-10 — distribui um novo valor total entre as parcelas Pendentes,
 * mantendo as parcelas Paga intactas.
 *
 * Algoritmo (espelha `gerar-parcelas`): cada parcela pendente recebe
 * `Math.floor(novoValorTotal / qtdPendentes)` centavos; o resto vai para a
 * última pendente (maior número).
 *
 * `elegiveis` (opcional) restringe a redistribuição a um subconjunto de ids —
 * usado para travar parcelas em fatura Fechada/Paga (RN-06). Sem o conjunto,
 * toda Pendente é elegível. Parcela Paga nunca é elegível, mesmo se listada.
 *
 * Devolve o array original com as elegíveis atualizadas (mesma ordem).
 * Não muta o input.
 *
 * @throws se `novoValorTotalCentavos < 0` ou se não houver parcela elegível
 *         quando `novoValorTotalCentavos > 0`.
 */
export function recalcularParcelasPendentes(
  parcelas: readonly Parcela[],
  novoValorTotalCentavos: number,
  elegiveis?: ReadonlySet<number>
): Parcela[] {
  if (novoValorTotalCentavos < 0) {
    throw new Error(`novoValorTotalCentavos deve ser >= 0, recebido: ${novoValorTotalCentavos}`)
  }

  const pendentesIndex = parcelas
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.status === 'Pendente' && (elegiveis === undefined || elegiveis.has(p.id)))

  if (pendentesIndex.length === 0) {
    if (novoValorTotalCentavos > 0) {
      throw new Error(
        'Sem parcelas pendentes em fatura aberta para receber o novo valor. Edição de valor bloqueada.'
      )
    }
    return [...parcelas]
  }

  // Ordena por numero para garantir que "última" seja a de maior número
  const ordenadas = [...pendentesIndex].sort((a, b) => a.p.numero - b.p.numero)
  const qtd = ordenadas.length
  const base = Math.floor(novoValorTotalCentavos / qtd)
  const resto = novoValorTotalCentavos - base * qtd

  const novoValorPorIndex = new Map<number, number>()
  ordenadas.forEach(({ i }, posicao) => {
    novoValorPorIndex.set(i, posicao === qtd - 1 ? base + resto : base)
  })

  return parcelas.map((p, i) => {
    const novo = novoValorPorIndex.get(i)
    if (novo === undefined) return p
    return { ...p, valorCentavos: novo }
  })
}
