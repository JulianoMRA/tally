import type { ItemSimulacao } from '../entities/simulacao'

export type ResultadoSimulacao = {
  baseCentavos: number
  totalEntradasCentavos: number
  totalSaidasCentavos: number
  saldoSimuladoCentavos: number
}

/**
 * RN-09 — saldo simulado.
 * saldo = base + entradas hipotéticas − saídas hipotéticas
 *
 * Só itens ativos contam; desligar um item o tira dos dois totais sem apagá-lo.
 * O efeito de cada item é `valor × repeticoes`, para "100 por fim de semana"
 * caber em uma linha em vez de quatro.
 *
 * A base pode ser negativa — é resultado de cálculo (a sobra projetada do mês,
 * RN-08, ou um valor digitado) e o mês pode estar no vermelho. O valor de um
 * item, não: valor monetário negativo não é representável, e o que decide o
 * sinal é o `tipo`. As duas guardas abaixo tornam esse invariante explícito
 * aqui, e não só nos schemas da borda.
 *
 * Função pura, sem I/O: nada nesta simulação toca despesa, parcela, fatura ou
 * recebimento.
 */
export function calcularSimulacao(
  baseCentavos: number,
  itens: readonly ItemSimulacao[]
): ResultadoSimulacao {
  let totalEntradasCentavos = 0
  let totalSaidasCentavos = 0

  for (const item of itens) {
    if (item.valorCentavos < 0) {
      throw new Error(`Item "${item.descricao}" tem valor negativo; use o tipo para o sinal.`)
    }
    if (!Number.isInteger(item.repeticoes) || item.repeticoes < 1) {
      throw new Error(`Item "${item.descricao}" tem repetições inválidas: ${item.repeticoes}.`)
    }
    if (!item.ativo) continue

    const efeito = item.valorCentavos * item.repeticoes
    if (item.tipo === 'entrada') {
      totalEntradasCentavos += efeito
    } else {
      totalSaidasCentavos += efeito
    }
  }

  return {
    baseCentavos,
    totalEntradasCentavos,
    totalSaidasCentavos,
    saldoSimuladoCentavos: baseCentavos + totalEntradasCentavos - totalSaidasCentavos
  }
}
