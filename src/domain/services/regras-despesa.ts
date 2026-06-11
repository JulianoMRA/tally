import type { Parcela } from '../entities/parcela'

/**
 * Status da fatura que contém a parcela; `null` quando a parcela não pertence
 * a fatura alguma (gasto fora de cartão).
 */
export type StatusFaturaDaParcela = 'Aberta' | 'Fechada' | 'Paga' | null

export type ParcelaComStatusFatura = {
  parcela: Parcela
  statusFatura: StatusFaturaDaParcela
}

export type PodeDeletarDespesaResult =
  | { ok: true }
  | { ok: false; motivo: 'has-parcela-paga'; parcelasPagas: number[] }
  | { ok: false; motivo: 'has-parcela-em-fatura-fechada'; parcelasBloqueadas: number[] }

/**
 * RF-DES-09 — regra pura de elegibilidade para exclusão de despesa.
 *
 * Despesa pode ser excluída se nenhuma parcela está Paga e nenhuma parcela
 * pertence a fatura Fechada ou Paga (RN-06: histórico fechado/pago é imutável).
 * Retorna os números das parcelas que motivam o bloqueio para a UI comunicar.
 */
export function podeDeletarDespesa(
  itens: readonly ParcelaComStatusFatura[]
): PodeDeletarDespesaResult {
  const pagas = itens
    .filter(({ parcela }) => parcela.status === 'Paga')
    .map((i) => i.parcela.numero)
  if (pagas.length > 0) {
    return { ok: false, motivo: 'has-parcela-paga', parcelasPagas: pagas }
  }

  const emFaturaImutavel = itens
    .filter(({ statusFatura }) => statusFatura === 'Fechada' || statusFatura === 'Paga')
    .map((i) => i.parcela.numero)
  if (emFaturaImutavel.length > 0) {
    return {
      ok: false,
      motivo: 'has-parcela-em-fatura-fechada',
      parcelasBloqueadas: emFaturaImutavel
    }
  }

  return { ok: true }
}

export type PodeEditarDespesaResult =
  | { ok: true }
  | { ok: false; motivo: 'has-parcela-paga'; parcelasPagas: number[] }

/**
 * RF-DES-10 — regra pura de elegibilidade para edição de despesa.
 *
 * Edição é bloqueada apenas quando há parcela Paga. Parcelas em fatura
 * Fechada não bloqueiam a edição como um todo — elas apenas ficam fora da
 * redistribuição de valor (ver `parcelasElegiveisParaRecalculo`).
 */
export function podeEditarDespesa(
  itens: readonly ParcelaComStatusFatura[]
): PodeEditarDespesaResult {
  const pagas = itens
    .filter(({ parcela }) => parcela.status === 'Paga')
    .map((i) => i.parcela.numero)
  if (pagas.length > 0) {
    return { ok: false, motivo: 'has-parcela-paga', parcelasPagas: pagas }
  }
  return { ok: true }
}

/**
 * RF-DES-10 — ids das parcelas que podem receber redistribuição de valor:
 * Pendentes em fatura Aberta ou sem fatura. Parcelas em fatura Fechada/Paga
 * ficam travadas (o valor delas já está comprometido com o banco).
 */
export function parcelasElegiveisParaRecalculo(
  itens: readonly ParcelaComStatusFatura[]
): Set<number> {
  const elegiveis = new Set<number>()
  for (const { parcela, statusFatura } of itens) {
    if (parcela.status !== 'Pendente') continue
    if (statusFatura === null || statusFatura === 'Aberta') {
      elegiveis.add(parcela.id)
    }
  }
  return elegiveis
}
