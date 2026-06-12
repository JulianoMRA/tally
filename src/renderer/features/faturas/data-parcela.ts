import type { Despesa } from '@domain/entities/despesa'
import type { Parcela } from '@domain/entities/parcela'

/**
 * Data exibida na coluna "Data" da fatura, em ISO (formatar só no render —
 * a ordenação compara strings ISO, que são cronológicas).
 *
 * Única/Parcelada mostram a data real da compra, como em faturas reais de
 * cartão. Assinatura mantém a competência mensal (dataReferencia) até a
 * Fase 3, pois a data de contratação não representa a cobrança do mês.
 */
export function dataParcelaExibida(parcela: Parcela, despesa: Despesa | undefined): string {
  if (!despesa || despesa.tipo === 'Assinatura') return parcela.dataReferencia
  return despesa.dataCompra
}
