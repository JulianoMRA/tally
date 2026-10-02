import { formatBRL } from '../../lib/format-brl'

/**
 * O contexto que acompanha o número de uma fatura com pagamento parcial:
 * "R$ 200,00 pagos de R$ 800,00". Null quando não há parcial.
 *
 * Com parcial, o número principal da fatura passa a ser o que falta pagar
 * (RN-10). Sem este contexto o card do trilho mostraria R$ 600 numa fatura de
 * R$ 800 sem dizer para onde foram os R$ 200 — e dois valores para a mesma
 * fatura, sem explicação, se leem como defeito.
 */
export function contextoDoParcial(fatura: {
  totalCentavos: number
  pagoParcialCentavos: number
}): string | null {
  if (fatura.pagoParcialCentavos <= 0) return null
  return `${formatBRL(fatura.pagoParcialCentavos)} pagos de ${formatBRL(fatura.totalCentavos)}`
}
