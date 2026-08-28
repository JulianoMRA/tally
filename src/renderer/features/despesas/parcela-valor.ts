import { parseCentavos } from '../../lib/dinheiro'

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
