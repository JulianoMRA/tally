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

/**
 * Rótulo "vencida há N dias" para faturas vencidas; null caso contrário.
 *
 * `nadaAPagar` é a fatura cujos pagamentos parciais já cobrem o total (RN-10):
 * não há o que pagar, só o que marcar, e "vencida" em vermelho seria alarme
 * falso. Quem sabe disso é quem chama, que tem os valores; aqui só há a fatura.
 */
export function rotuloVencida(fatura: Fatura, hoje: string, nadaAPagar = false): string | null {
  if (nadaAPagar || !estaVencida(fatura, hoje)) return null
  const dias = diferencaEmDias(fatura.dataVencimento, hoje)
  return dias === 1 ? 'vencida há 1 dia' : `vencida há ${dias} dias`
}

/**
 * Rótulo "vence em N dias" para faturas Fechadas com vencimento próximo
 * (0..7 dias, a mesma janela do "fecha em"). Aberta ainda não é pagável e Paga
 * não vence; depois do vencimento quem fala é `rotuloVencida`.
 */
export function rotuloVencimento(fatura: Fatura, hoje: string): string | null {
  if (fatura.status.kind !== 'Fechada') return null
  const dias = diferencaEmDias(hoje, fatura.dataVencimento)
  if (dias < 0 || dias > LIMIAR_AVISO_DIAS) return null
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

export type AvisoDePrazo = {
  texto: string
  /** `alerta` é o prazo que passou; `atencao`, o que está chegando. */
  tom: 'alerta' | 'atencao'
}

/**
 * O aviso que acompanha o prazo de uma fatura, com o tom dele. Os três rótulos
 * nunca valem juntos — "fecha em" é de Aberta, os outros dois de Fechada —,
 * mas quem exibe não precisa saber disso para compô-los.
 *
 * Com `nadaAPagar` (ver `rotuloVencida`), a fatura Fechada não avisa
 * vencimento nenhum. A Aberta segue avisando o fechamento: fechar continua
 * sendo um evento, com ou sem valor a pagar (RN-06).
 */
export function avisoDePrazo(
  fatura: Fatura,
  hoje: string,
  nadaAPagar = false
): AvisoDePrazo | null {
  if (nadaAPagar && fatura.status.kind === 'Fechada') return null
  const vencida = rotuloVencida(fatura, hoje)
  if (vencida) return { texto: vencida, tom: 'alerta' }
  const chegando = rotuloVencimento(fatura, hoje) ?? rotuloFechamento(fatura, hoje)
  return chegando ? { texto: chegando, tom: 'atencao' } : null
}
