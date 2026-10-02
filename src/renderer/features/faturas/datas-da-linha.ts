import type { Fatura } from '@domain/entities/fatura'
import { formatarDataIso } from '../../lib/formatar-data'

/**
 * As datas de uma linha do histórico: quando a fatura fechou e quando venceu,
 * vence ou foi paga.
 *
 * O tempo do verbo vem do calendário. A linha dizia "Fecha 25/06/2026 · Vence
 * 05/07/2026" para datas que já tinham passado, e em caixa diferente do aviso
 * que vinha logo depois ("vencida há 88 dias").
 *
 * A fatura fecha no início do dia de fechamento (RN-06), então nesse dia ela
 * já fechou. O dia do vencimento ainda não é atraso: ainda dá tempo de pagar.
 */
export function datasDaLinha(fatura: Fatura, hoje: string): string {
  const fechamento = `${fatura.dataFechamento <= hoje ? 'fechou' : 'fecha'} ${formatarDataIso(fatura.dataFechamento)}`

  if (fatura.status.kind === 'Paga') {
    return `${fechamento} · paga em ${formatarDataIso(fatura.status.pagaEm)}`
  }
  const vencimento = `${fatura.dataVencimento < hoje ? 'venceu' : 'vence'} ${formatarDataIso(fatura.dataVencimento)}`
  return `${fechamento} · ${vencimento}`
}
