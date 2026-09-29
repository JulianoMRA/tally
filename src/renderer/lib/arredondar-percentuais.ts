/**
 * Percentuais inteiros de cada valor sobre o total, **somando exatamente 100**
 * (método do maior resto). Arredondar cada um isoladamente dá 33 + 33 + 33 para
 * três terços, e uma legenda que soma 99% se lê como erro de conta.
 *
 * Os pontos que faltam vão para os maiores restos; empate fica com quem vem
 * primeiro na lista — no ranking, a categoria maior. Resto e parte inteira saem
 * de divisão inteira (os valores são centavos), então o empate de restos é
 * comparado exatamente, sem depender de ponto flutuante.
 *
 * Total zero devolve zeros: não há proporção a dividir.
 */
export function arredondarPercentuais(valores: readonly number[]): number[] {
  const total = valores.reduce((s, v) => s + v, 0)
  if (total <= 0) return valores.map(() => 0)

  const partes = valores.map((valor, indice) => {
    const escalado = valor * 100
    const resto = escalado % total
    return { indice, inteiro: (escalado - resto) / total, resto }
  })

  const faltam = 100 - partes.reduce((s, p) => s + p.inteiro, 0)
  const porResto = [...partes].sort((a, b) => b.resto - a.resto || a.indice - b.indice)
  for (const parte of porResto.slice(0, faltam)) parte.inteiro += 1

  return partes.map((p) => p.inteiro)
}
