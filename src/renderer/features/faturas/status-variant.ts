import type { StatusFatura } from '@domain/entities/fatura'

export type StatusFaturaVariant = 'open' | 'closed' | 'paid'

/**
 * Mapeia o status de uma fatura para a variante visual do Badge.
 */
export function statusVariant(kind: StatusFatura['kind']): StatusFaturaVariant {
  if (kind === 'Aberta') return 'open'
  if (kind === 'Fechada') return 'closed'
  return 'paid'
}
