/**
 * Valor pago numa fatura antes da quitação (RN-10).
 *
 * Não é adiantamento de parcela (RN-03): aquele move parcelas entre faturas e
 * muda o total das duas; este abate o que falta pagar de uma fatura só, sem
 * tocar em parcela nenhuma.
 */
export type PagamentoParcial = {
  id: number
  faturaId: number
  valorCentavos: number
  dataPagamento: string
  createdAt: string
  updatedAt: string
}
