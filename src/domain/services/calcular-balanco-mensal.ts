export type BalancoMensalInput = {
  /**
   * Quanto as faturas do mês pesam: a soma do que falta pagar de cada uma
   * (RN-10), e não a soma dos totais. Sem pagamento parcial, é o mesmo número.
   */
  totalFaturasCentavos: number
  totalGastosForaCartaoCentavos: number
  totalRecebidoCentavos: number
  totalEsperadoCentavos: number
}

export type BalancoMensal = {
  totalSaidasCentavos: number
  totalEntradasRecebidasCentavos: number
  totalEntradasProjetadasCentavos: number
  saldoRealizadoCentavos: number
  saldoProjetadoCentavos: number
}

/**
 * RN-08 — saldo mensal.
 * saldo = recebimentos do mês − (faturas + gastos fora cartão)
 *
 * A fatura entra pelo que falta pagar (RN-10), em qualquer status: o pagamento
 * parcial abate a fatura e não conta como saída em mês nenhum. Quem monta a
 * entrada é quem conhece os pagamentos; esta função só soma.
 *
 * "Realizado" usa apenas Recebido (caixa real até agora);
 * "Projetado" soma Recebido + Esperado (projeção do mês fechado).
 */
export function calcularBalancoMensal(input: BalancoMensalInput): BalancoMensal {
  const totalSaidasCentavos = input.totalFaturasCentavos + input.totalGastosForaCartaoCentavos
  const totalEntradasRecebidasCentavos = input.totalRecebidoCentavos
  const totalEntradasProjetadasCentavos = input.totalRecebidoCentavos + input.totalEsperadoCentavos
  const saldoRealizadoCentavos = totalEntradasRecebidasCentavos - totalSaidasCentavos
  const saldoProjetadoCentavos = totalEntradasProjetadasCentavos - totalSaidasCentavos

  return {
    totalSaidasCentavos,
    totalEntradasRecebidasCentavos,
    totalEntradasProjetadasCentavos,
    saldoRealizadoCentavos,
    saldoProjetadoCentavos
  }
}
