import { ehValorValido, parseCentavos } from '../../lib/dinheiro'
import { formatBRL } from '../../lib/format-brl'

export type ModoValorParcela = 'total' | 'parcela'

/**
 * Resolve o valor TOTAL da compra parcelada em centavos a partir do modo de
 * entrada: 'total' usa o valor digitado direto; 'parcela' multiplica o valor de
 * cada parcela pelo número de parcelas. Arredonda para centavos ANTES de
 * multiplicar para evitar erro de ponto flutuante.
 */
export function valorTotalCentavosParcelada(
  modo: ModoValorParcela,
  valorReais: string,
  totalParcelas: number
): number {
  const centavos = parseCentavos(valorReais)
  return modo === 'parcela' ? centavos * totalParcelas : centavos
}

/**
 * Texto da prévia do parcelamento, ou null enquanto a entrada não permite
 * calculá-la.
 *
 * Vivia inline no `DespesaForm` com `parseFloat(valorReais.replace(',', '.'))`
 * — o único ponto do app que não passava pelo `parseCentavos`, e justamente o
 * caso que motivou centralizar a leitura de valor. O replace troca só a
 * PRIMEIRA vírgula, então `'2.500,00'` virava `'2.500.00'`, que o `parseFloat`
 * lê como `2.5`: a prévia de doze parcelas anunciava `R$ 0,21` no lugar de
 * `R$ 208,33`. O valor gravado nunca esteve errado (o submit já usava
 * `valorTotalCentavosParcelada`), mas a tela mentia sobre ele.
 *
 * A aritmética é inteira, em centavos, e a formatação passa pelo `formatBRL` —
 * antes o texto saía com ponto decimal (`R$ 208.33`), fora do padrão pt-BR que
 * o resto do app usa.
 */
export function textoPreviaParcelamento(
  modo: ModoValorParcela,
  valorReais: string,
  totalParcelas: number
): string | null {
  if (!Number.isInteger(totalParcelas) || totalParcelas < 1) return null
  if (!ehValorValido(valorReais)) return null

  const centavos = parseCentavos(valorReais)
  return modo === 'total'
    ? `≈ ${formatBRL(Math.round(centavos / totalParcelas))} por parcela`
    : `= ${formatBRL(centavos * totalParcelas)} no total`
}
