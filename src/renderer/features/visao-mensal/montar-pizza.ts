import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { arredondarPercentuais } from '../../lib/arredondar-percentuais'

/**
 * Teto de fatias da pizza. A partir de sete, a pizza de ago/2026 deixava de ser
 * legível e saiu da tela; seis é o limite em que ela ainda se lê de relance.
 */
export const MAXIMO_FATIAS = 6

/** Geometria no viewBox 0 0 100 100. O raio deixa 2 de folga para o contorno. */
const CENTRO = 50
const RAIO = 48

type FatiaBase = {
  chave: string
  nome: string
  totalCentavos: number
  /** Inteiro para a legenda; soma 100 e é o mesmo do ranking. */
  percentual: number
  /** Graus a partir das 12h, em sentido horário. */
  inicioGraus: number
  fimGraus: number
  /** Atributo `d` do `<path>`. */
  caminho: string
}

export type FatiaPizza =
  | (FatiaBase & { tipo: 'categoria'; categoriaId: number; cor: string })
  | (FatiaBase & { tipo: 'outros'; agrupadas: string[] })

type Parte = {
  total: TotalPorCategoria
  percentual: number
}

function numero(valor: number): string {
  return String(Number(valor.toFixed(2)))
}

function ponto(graus: number): string {
  const radianos = (graus * Math.PI) / 180
  return `${numero(CENTRO + RAIO * Math.sin(radianos))} ${numero(CENTRO - RAIO * Math.cos(radianos))}`
}

function caminhoDaFatia(inicioGraus: number, fimGraus: number): string {
  const arco = `A ${RAIO} ${RAIO} 0`
  // Um arco só não fecha 360°: início e fim coincidem e o SVG não desenha nada.
  if (fimGraus - inicioGraus >= 360) {
    return `M ${ponto(0)} ${arco} 1 1 ${ponto(180)} ${arco} 1 1 ${ponto(0)} Z`
  }
  const arcoGrande = fimGraus - inicioGraus > 180 ? 1 : 0
  return `M ${CENTRO} ${CENTRO} L ${ponto(inicioGraus)} ${arco} ${arcoGrande} 1 ${ponto(fimGraus)} Z`
}

/**
 * RF-VIS-08 — fatias da pizza de gastos do mês, com o mesmo dado do ranking
 * "Para onde foi".
 *
 * Os percentuais são calculados sobre a lista inteira, na ordem da query, antes
 * de qualquer corte: é a mesma conta do `montarRanking`, então cada categoria
 * mostra o mesmo número nos dois cards, e "Outros" é exatamente a soma do que
 * ele agrupa. Já os ângulos saem do valor exato — o arredondamento é da
 * legenda, não do desenho.
 *
 * Categoria com total zero fica fora (a parcela de R$ 0,00 existe) e não ocupa
 * lugar no teto. A ordenação é estável: empates mantêm a ordem da query, que é
 * a do ranking.
 */
export function montarPizza(totais: readonly TotalPorCategoria[]): FatiaPizza[] {
  const percentuais = arredondarPercentuais(totais.map((t) => t.totalCentavos))
  const partes: Parte[] = totais
    .map((total, indice) => ({ total, percentual: percentuais[indice] ?? 0 }))
    .filter((p) => p.total.totalCentavos > 0)
    .sort((a, b) => b.total.totalCentavos - a.total.totalCentavos)

  const somaCentavos = partes.reduce((s, p) => s + p.total.totalCentavos, 0)
  if (somaCentavos === 0) return []

  const cabem = partes.length <= MAXIMO_FATIAS
  const visiveis = cabem ? partes : partes.slice(0, MAXIMO_FATIAS - 1)
  const agrupadas = cabem ? [] : partes.slice(MAXIMO_FATIAS - 1)

  let acumulado = 0
  function angulos(valor: number) {
    const inicioGraus = (acumulado / somaCentavos) * 360
    acumulado += valor
    const fimGraus = (acumulado / somaCentavos) * 360
    return { inicioGraus, fimGraus, caminho: caminhoDaFatia(inicioGraus, fimGraus) }
  }

  const fatias: FatiaPizza[] = visiveis.map(({ total, percentual }) => ({
    tipo: 'categoria',
    chave: `categoria-${total.categoriaId}`,
    categoriaId: total.categoriaId,
    nome: total.categoriaNome,
    cor: total.cor,
    totalCentavos: total.totalCentavos,
    percentual,
    ...angulos(total.totalCentavos)
  }))

  if (agrupadas.length > 0) {
    const totalCentavos = agrupadas.reduce((s, p) => s + p.total.totalCentavos, 0)
    fatias.push({
      tipo: 'outros',
      chave: 'outros',
      nome: 'Outros',
      agrupadas: agrupadas.map((p) => p.total.categoriaNome),
      totalCentavos,
      percentual: agrupadas.reduce((s, p) => s + p.percentual, 0),
      ...angulos(totalCentavos)
    })
  }

  return fatias
}
