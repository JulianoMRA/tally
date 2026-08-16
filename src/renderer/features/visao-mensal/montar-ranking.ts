import type { StatusOrcamento } from '@domain/services/calcular-orcamento'
import type { LinhaOrcamentoComOrigem } from '@shared/ipc/orcamento'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'

export type LimiteNoRanking = {
  limiteCentavos: number
  /** Posição da marca vertical, na mesma escala da barra. Nunca passa de 100. */
  posicaoPct: number
  /** True quando o limite ficou além da escala e a marca encostou no fim. */
  foraDeEscala: boolean
  /** Quanto do limite já foi usado. Pode passar de 100. */
  usoPct: number
  status: StatusOrcamento
}

export type LinhaRanking = {
  categoriaId: number
  nome: string
  cor: string
  totalCentavos: number
  /** Largura da barra, relativa à maior grandeza da lista. */
  larguraPct: number
  /** Fatia da categoria no gasto total do mês. */
  fatiaPct: number
  limite: LimiteNoRanking | null
}

function pct(parte: number, todo: number): number {
  if (todo <= 0) return 0
  return (parte / todo) * 100
}

/**
 * RF-ORC-02 (leitura) — funde o ranking de categorias com o orçamento, para
 * que uma barra só carregue as duas informações. Antes eram dois painéis
 * dizendo a mesma coisa: o ranking mostrava o gasto e o painel de orçamento
 * repetia o gasto ao lado do limite.
 *
 * A barra e a marca de limite dividem a mesma escala, senão a comparação visual
 * mente. O denominador é o **maior gasto** — este painel é primeiro um ranking,
 * e a categoria do topo precisa encher a barra.
 *
 * Esticar a escala para caber o maior limite foi tentado e descartado: um
 * limite generoso numa categoria pequena achatava todas as barras. Medido na
 * folha de contato de 16/08 — Mercado com limite de R$ 944 e gasto de R$ 85
 * derrubava Casa, a maior do mês, para 42% da própria barra. Limite acima da
 * escala encosta a marca no fim e marca `foraDeEscala`; o texto "N% do limite"
 * é quem dá o número exato.
 */
export function montarRanking(
  totais: readonly TotalPorCategoria[],
  orcamento: readonly LinhaOrcamentoComOrigem[]
): LinhaRanking[] {
  const limitePorCategoria = new Map<number, LinhaOrcamentoComOrigem>()
  for (const linha of orcamento) {
    limitePorCategoria.set(linha.categoriaId, linha)
  }

  const gastoTotal = totais.reduce((s, t) => s + t.totalCentavos, 0)
  const escala = totais.reduce((m, t) => Math.max(m, t.totalCentavos), 0)

  return totais.map((total) => {
    const linha = limitePorCategoria.get(total.categoriaId)
    const posicaoBruta = linha ? pct(linha.limiteCentavos, escala) : 0

    return {
      categoriaId: total.categoriaId,
      nome: total.categoriaNome,
      cor: total.cor,
      totalCentavos: total.totalCentavos,
      larguraPct: pct(total.totalCentavos, escala),
      fatiaPct: pct(total.totalCentavos, gastoTotal),
      limite:
        linha && linha.limiteCentavos > 0
          ? {
              limiteCentavos: linha.limiteCentavos,
              posicaoPct: Math.min(posicaoBruta, 100),
              foraDeEscala: posicaoBruta > 100,
              usoPct: linha.percentual,
              status: linha.status
            }
          : null
    }
  })
}
