import type { Fatura } from '@domain/entities/fatura'
import { diferencaEmDias } from '@domain/services/mes-referencia'

export const LIMIAR_AVISO_DIAS = 7

/**
 * Rótulo "fecha em N dias" para faturas Abertas com fechamento próximo
 * (0..7 dias). Null quando não há o que avisar — fatura Fechada/Paga,
 * fechamento distante ou já passado (o auto-fechamento resolve esse caso).
 */
export function rotuloFechamento(fatura: Fatura, hoje: string): string | null {
  if (fatura.status.kind !== 'Aberta') return null
  const dias = diferencaEmDias(hoje, fatura.dataFechamento)
  if (dias < 0 || dias > LIMIAR_AVISO_DIAS) return null
  if (dias === 0) return 'fecha hoje'
  if (dias === 1) return 'fecha amanhã'
  return `fecha em ${dias} dias`
}

/**
 * Fatura vencida: Fechada (não Paga) com data de vencimento já passada. Uma
 * Aberta fica de fora — ainda não é pagável — e uma Paga nunca vence. O próprio
 * dia do vencimento não conta como vencida (ainda dá tempo de pagar).
 */
export function estaVencida(fatura: Fatura, hoje: string): boolean {
  if (fatura.status.kind !== 'Fechada') return false
  return diferencaEmDias(hoje, fatura.dataVencimento) < 0
}

/** Rótulo "vencida há N dias" para faturas vencidas; null caso contrário. */
export function rotuloVencida(fatura: Fatura, hoje: string): string | null {
  if (!estaVencida(fatura, hoje)) return null
  const dias = diferencaEmDias(fatura.dataVencimento, hoje)
  return dias === 1 ? 'vencida há 1 dia' : `vencida há ${dias} dias`
}
