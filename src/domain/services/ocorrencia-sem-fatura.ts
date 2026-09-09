import type { StatusParcela } from '../entities/parcela'

/** O mínimo que decide a transição: quem é o dono da parcela, e onde ela está. */
export type OcorrenciaParaMarcar = {
  faturaId: number | null
  status: StatusParcela
}

export type MarcarOcorrenciaResult =
  | { ok: true }
  | { ok: false; motivo: 'pertence-a-fatura' | 'ja-paga' }

export type DesmarcarOcorrenciaResult =
  | { ok: true }
  | { ok: false; motivo: 'pertence-a-fatura' | 'ja-pendente' }

/**
 * RF-DES-21 — quem pode marcar uma ocorrência como paga.
 *
 * Com fatura, quem marca é o pagamento da fatura (RN-06). Marcar a parcela
 * isolada furaria o ciclo de vida: sobraria uma fatura Aberta com parcela Paga
 * dentro, estado que RN-06 não prevê e que o resto do app lê como incoerência.
 *
 * Sem fatura não existe esse dono — e até aqui não existia dono nenhum. Uma
 * compra no crédito ficava paga quando a fatura era paga; o aluguel no Pix não
 * tinha como ficar pago nunca, embora `parcela` já tivesse `status` e
 * `data_pagamento`. A assimetria era do app, não do domínio.
 *
 * **Esta regra não alimenta nenhum cálculo.** RN-08, o ranking de categorias e
 * o orçamento contam a ocorrência pela `data_referencia`, sem olhar o status —
 * conferido nas três consultas. O que o status muda são as regras que já o
 * liam: RF-DES-09 (excluir) e RF-DES-10 (editar) passam a bloquear, e cancelar
 * ou reajustar passam a preservar a ocorrência paga. Daí a existência do
 * desmarcar.
 */
export function podeMarcarOcorrenciaPaga(o: OcorrenciaParaMarcar): MarcarOcorrenciaResult {
  // A fatura é checada antes do status de propósito: quando os dois valem, a
  // mensagem precisa apontar o dono da decisão, não o sintoma.
  if (o.faturaId !== null) return { ok: false, motivo: 'pertence-a-fatura' }
  if (o.status === 'Paga') return { ok: false, motivo: 'ja-paga' }
  return { ok: true }
}

/**
 * RF-DES-21 — desmarcar.
 *
 * Existe porque marcar tem consequência: parcela Paga bloqueia excluir
 * (RF-DES-09) e editar (RF-DES-10) a despesa inteira. Sem volta, pagar o
 * aluguel de setembro travaria a despesa "Aluguel" para sempre — não daria nem
 * para corrigir um erro de digitação na descrição.
 *
 * É a mesma escotilha que reabrir uma fatura paga dá no lado do crédito
 * (RF-FAT-05), e pelo mesmo motivo: registrar pagamento por engano não pode ser
 * caminho sem volta.
 */
export function podeDesmarcarOcorrenciaPaga(o: OcorrenciaParaMarcar): DesmarcarOcorrenciaResult {
  if (o.faturaId !== null) return { ok: false, motivo: 'pertence-a-fatura' }
  if (o.status === 'Pendente') return { ok: false, motivo: 'ja-pendente' }
  return { ok: true }
}
