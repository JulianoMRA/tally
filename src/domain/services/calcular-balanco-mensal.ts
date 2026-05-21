export type BalancoMensalInput = {
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
