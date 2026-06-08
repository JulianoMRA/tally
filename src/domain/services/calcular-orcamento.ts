export type StatusOrcamento = 'ok' | 'alerta' | 'estourado'

export type ResultadoOrcamento = {
  percentual: number
  status: StatusOrcamento
}

export type LimiteCategoria = {
  categoriaId: number
  categoriaNome: string
  cor: string
  limiteCentavos: number
}

export type RealizadoCategoria = {
  categoriaId: number
  totalCentavos: number
}

export type LinhaOrcamento = LimiteCategoria & {
  realizadoCentavos: number
  percentual: number
  status: StatusOrcamento
}

const LIMIAR_ALERTA = 0.8

/**
 * Calcula o percentual realizado e o status de um orçamento. Valores em centavos.
 * Status: ok (< 80%), alerta (>= 80% e < 100%), estourado (>= 100%). Limite zero com
 * realizado é tratado como estourado (gasto sem orçamento). Função pura, sem I/O.
 */
export function calcularStatusOrcamento(
  limiteCentavos: number,
  realizadoCentavos: number
): ResultadoOrcamento {
  if (limiteCentavos <= 0) {
    return realizadoCentavos > 0
      ? { percentual: 100, status: 'estourado' }
      : { percentual: 0, status: 'ok' }
  }

  const razao = realizadoCentavos / limiteCentavos
  const percentual = Math.round(razao * 100)
  const status: StatusOrcamento =
    razao >= 1 ? 'estourado' : razao >= LIMIAR_ALERTA ? 'alerta' : 'ok'
  return { percentual, status }
}

/**
 * Cruza os limites definidos por categoria com o realizado do mês e devolve as linhas
 * do painel de orçamento, ordenadas por percentual decrescente (mais crítico primeiro).
 * Itera sobre os limites: categorias sem limite não aparecem; categoria sem gasto no
 * mês entra com realizado zero. Função pura, sem I/O.
 */
export function montarVisaoOrcamento(
  limites: readonly LimiteCategoria[],
  realizadoPorCategoria: readonly RealizadoCategoria[]
): LinhaOrcamento[] {
  const realizadoPorId = new Map<number, number>()
  for (const item of realizadoPorCategoria) {
    realizadoPorId.set(item.categoriaId, item.totalCentavos)
  }

  return limites
    .map((limite) => {
      const realizadoCentavos = realizadoPorId.get(limite.categoriaId) ?? 0
      const { percentual, status } = calcularStatusOrcamento(
        limite.limiteCentavos,
        realizadoCentavos
      )
      return { ...limite, realizadoCentavos, percentual, status }
    })
    .sort((a, b) => b.percentual - a.percentual)
}
