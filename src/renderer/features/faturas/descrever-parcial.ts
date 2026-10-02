import type { Fatura } from '@domain/entities/fatura'
import { formatBRL } from '../../lib/format-brl'

/**
 * O contexto que acompanha o número de uma fatura com pagamento parcial, ou
 * null quando não há parcial.
 *
 * Com parcial, o número principal da fatura passa a ser o que falta pagar
 * (RN-10). Sem este contexto o card do trilho mostraria R$ 600 numa fatura de
 * R$ 800 sem dizer para onde foram os R$ 200 — e dois valores para a mesma
 * fatura, sem explicação, se leem como defeito.
 *
 * Na fatura a pagar: "R$ 200,00 pagos de R$ 800,00". Na paga o mesmo texto,
 * ao lado do selo "Paga", se lia como se só uma parte tivesse sido paga; ali o
 * contexto diz só quanto foi em pagamentos parciais.
 */
export function contextoDoParcial(fatura: {
  totalCentavos: number
  pagoParcialCentavos: number
  fatura: Pick<Fatura, 'status'>
}): string | null {
  if (fatura.pagoParcialCentavos <= 0) return null
  const pago = formatBRL(fatura.pagoParcialCentavos)
  if (fatura.fatura.status.kind === 'Paga') return `${pago} em pagamentos parciais`
  return `${pago} pagos de ${formatBRL(fatura.totalCentavos)}`
}
