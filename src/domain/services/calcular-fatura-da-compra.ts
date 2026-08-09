import { clampDiaNoMes, diasNoMes } from './mes-referencia'

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
  validarDiaDoMes(dia, 'diaFechamento')
}

function validarDiaDoMes(dia: number, campo: string): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new Error(`${campo} inválido: ${dia}. Deve ser inteiro entre 1 e 31.`)
  }
}

/**
 * RN-01 — descobre em qual fatura uma compra cai.
 *   * dia(dataCompra) <  diaFechamento → fatura do mesmo mês
 *   * dia(dataCompra) >= diaFechamento → fatura do mês seguinte
 *
 * A fatura fecha no início do dia F (RN-06 marca Fechada quando
 * data_fechamento <= hoje), então a compra feita no próprio dia F
 * já pertence ao ciclo seguinte.
 */
export function calcularReferenciaFaturaDaCompra(
  dataCompra: string,
  diaFechamento: number
): ReferenciaFatura {
  validarDiaFechamento(diaFechamento)
  const { ano, mes, dia } = parseDataIso(dataCompra)

  if (dia < diaFechamento) {
    return { ano, mes }
  }
  if (mes === 12) {
    return { ano: ano + 1, mes: 1 }
  }
  return { ano, mes: mes + 1 }
}

export type DatasDaFatura = {
  dataFechamento: string
  dataVencimento: string
}

/**
 * Datas do ciclo de uma fatura em um mês de referência.
 *
 * Quando o dia de vencimento é anterior ao de fechamento (ex.: fecha 24, vence
 * 01), o vencimento pertence ao **mês seguinte** ao do fechamento — é o mesmo
 * ciclo, só pago no mês adiante. Calcular as duas datas no mesmo mês fazia a
 * fatura nascer vencida no instante em que fechava, anulava a janela `Fechada`
 * de RN-06 e impedia o aviso de vencimento próximo.
 *
 * Com V >= F (Inter F=05/V=12, Nubank F=15/V=22) as duas datas ficam no mesmo
 * mês, como sempre estiveram.
 */
export function calcularDatasDaFatura(
  ref: ReferenciaFatura,
  diaFechamento: number,
  diaVencimento: number
): DatasDaFatura {
  validarDiaDoMes(diaFechamento, 'diaFechamento')
  validarDiaDoMes(diaVencimento, 'diaVencimento')

  const refVencimento = diaVencimento < diaFechamento ? proximaReferencia(ref) : ref

  return {
    dataFechamento: clampDiaNoMes(ref.ano, ref.mes, diaFechamento),
    dataVencimento: clampDiaNoMes(refVencimento.ano, refVencimento.mes, diaVencimento)
  }
}

function proximaReferencia(ref: ReferenciaFatura): ReferenciaFatura {
  if (ref.mes === 12) return { ano: ref.ano + 1, mes: 1 }
  return { ano: ref.ano, mes: ref.mes + 1 }
}

export function formatarMesReferencia(ref: ReferenciaFatura): string {
  return `${ref.ano.toString().padStart(4, '0')}-${ref.mes.toString().padStart(2, '0')}`
}
