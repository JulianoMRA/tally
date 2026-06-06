import { diasNoMes } from './mes-referencia'

export type ReferenciaFatura = {
  ano: number
  mes: number
}

const DATA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDataIso(data: string): { ano: number; mes: number; dia: number } {
  const match = DATA_REGEX.exec(data)
  if (!match) {
    throw new Error(`Data inválida: '${data}'. Esperado formato YYYY-MM-DD.`)
  }
  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])

  if (mes < 1 || mes > 12) {
    throw new Error(`Mês inválido em '${data}': ${mes}`)
  }
  if (dia < 1 || dia > diasNoMes(ano, mes)) {
    throw new Error(`Dia inválido em '${data}': ${dia}`)
  }
  return { ano, mes, dia }
}

function validarDiaFechamento(dia: number): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new Error(`diaFechamento inválido: ${dia}. Deve ser inteiro entre 1 e 31.`)
  }
}

/**
 * RN-01 — descobre em qual fatura uma compra cai.
 *   * dia(dataCompra) <= diaFechamento → fatura do mesmo mês
 *   * dia(dataCompra)  > diaFechamento → fatura do mês seguinte
 */
export function calcularReferenciaFaturaDaCompra(
  dataCompra: string,
  diaFechamento: number
): ReferenciaFatura {
  validarDiaFechamento(diaFechamento)
  const { ano, mes, dia } = parseDataIso(dataCompra)

  if (dia <= diaFechamento) {
    return { ano, mes }
  }
  if (mes === 12) {
    return { ano: ano + 1, mes: 1 }
  }
  return { ano, mes: mes + 1 }
}

export function formatarMesReferencia(ref: ReferenciaFatura): string {
  return `${ref.ano.toString().padStart(4, '0')}-${ref.mes.toString().padStart(2, '0')}`
}
