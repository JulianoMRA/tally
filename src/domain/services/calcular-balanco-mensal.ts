export type BalancoMensalInput = {
  totalFaturasLiquidoCentavos: number
  totalGastosForaCartaoCentavos: number
  totalRecebidoCentavos: number
  totalEsperadoCentavos: number
}

export type BalancoMensal = {
  totalSaidasLiquidasCentavos: number
  totalEntradasRecebidasCentavos: number
  totalEntradasProjetadasCentavos: number
  saldoRealizadoCentavos: number
  saldoProjetadoCentavos: number
}

/**
 * RN-08 — saldo mensal.
 * saldo = recebimentos do mês − (faturas líquido + gastos fora cartão)
 *
 * Ajudas recebidas NÃO entram em recebimentos (RF-AJU-06: reembolso, não receita).
 * "Realizado" usa apenas Recebido (caixa real até agora);
 * "Projetado" soma Recebido + Esperado (projeção do mês fechado).
 */
export function calcularBalancoMensal(input: BalancoMensalInput): BalancoMensal {
  const totalSaidasLiquidasCentavos =
    input.totalFaturasLiquidoCentavos + input.totalGastosForaCartaoCentavos
  const totalEntradasRecebidasCentavos = input.totalRecebidoCentavos
  const totalEntradasProjetadasCentavos = input.totalRecebidoCentavos + input.totalEsperadoCentavos
  const saldoRealizadoCentavos = totalEntradasRecebidasCentavos - totalSaidasLiquidasCentavos
  const saldoProjetadoCentavos = totalEntradasProjetadasCentavos - totalSaidasLiquidasCentavos

  return {
    totalSaidasLiquidasCentavos,
    totalEntradasRecebidasCentavos,
    totalEntradasProjetadasCentavos,
    saldoRealizadoCentavos,
    saldoProjetadoCentavos
  }
}
