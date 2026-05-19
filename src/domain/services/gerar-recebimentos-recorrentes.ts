import { clampDiaNoMes } from './mes-referencia'

export type RecebimentoPlanejado = {
  dataEsperada: string
  valorCentavos: number
}

export type GerarRecebimentosRecorrentesInput = {
  dataInicio: string
  valorPadraoCentavos: number
  diaEsperado: number
  quantidade: number
  ocorrenciaInicial?: number
}

const DATA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function parseData(data: string): { ano: number; mes: number; dia: number } {
  const m = DATA_REGEX.exec(data)
  if (!m) throw new Error(`Data inválida: '${data}'. Esperado YYYY-MM-DD.`)
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

function avancarMes(ano: number, mes: number): { ano: number; mes: number } {
  if (mes === 12) return { ano: ano + 1, mes: 1 }
  return { ano, mes: mes + 1 }
}

/**
 * RF-REN-02 — gera N datas de recebimento mensais a partir de uma data de
 * início e um dia esperado. A primeira ocorrência cai no `diaEsperado` do
 * mês de `dataInicio` se este já não passou; caso contrário, no mês seguinte.
 * Datas que excedem o último dia do mês (ex.: dia 31 em fevereiro) são
 * clamped via `clampDiaNoMes`.
 */
export function gerarRecebimentosRecorrentes(
  input: GerarRecebimentosRecorrentesInput
): RecebimentoPlanejado[] {
  const { dataInicio, valorPadraoCentavos, diaEsperado, quantidade } = input
  void (input.ocorrenciaInicial ?? 1) // reservado para Slice 12

  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error(`quantidade deve ser inteiro >= 1, recebido: ${quantidade}`)
  }
  if (valorPadraoCentavos <= 0) {
    throw new Error(`valorPadraoCentavos deve ser > 0, recebido: ${valorPadraoCentavos}`)
  }
  if (!Number.isInteger(diaEsperado) || diaEsperado < 1 || diaEsperado > 31) {
    throw new Error(`diaEsperado deve ser inteiro entre 1 e 31, recebido: ${diaEsperado}`)
  }

  const { ano: anoInicio, mes: mesInicio, dia: diaInicio } = parseData(dataInicio)

  let { ano, mes } =
    diaInicio <= diaEsperado ? { ano: anoInicio, mes: mesInicio } : avancarMes(anoInicio, mesInicio)

  const resultado: RecebimentoPlanejado[] = []
  for (let i = 0; i < quantidade; i++) {
    resultado.push({
      dataEsperada: clampDiaNoMes(ano, mes, diaEsperado),
      valorCentavos: valorPadraoCentavos
    })
    ;({ ano, mes } = avancarMes(ano, mes))
  }
  return resultado
}
