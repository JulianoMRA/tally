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
