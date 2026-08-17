import type { TipoDespesa } from '../entities/despesa'
import type { StatusParcela } from '../entities/parcela'

export type DespesaDaOcorrencia = {
  tipo: TipoDespesa
  valorCentavos: number
  totalParcelas: number | null
}

export type ParcelaDaOcorrencia = {
  numero: number
  total: number | null
  valorCentavos: number
  dataReferencia: string
  status: StatusParcela
}

export type Ocorrencia = {
  /** O que sai neste mês. É a única grandeza somável da lista. */
  impactoCentavos: number
  /** Valor cheio da compra, só quando é conhecido e difere do impacto. */
  origemCentavos: number | null
  rotuloParcela: string
  /** Fração já percorrida do parcelamento, 0–100. Null quando não se aplica. */
  progressoPct: number | null
}

/**
 * RF-DES-14 — descreve a ocorrência de uma despesa em um mês.
 *
 * Responde o ponto 10 do diagnóstico: a coluna de valor empilhava R$ 4.999,00
 * (total de um parcelado), R$ 44,90 (mensalidade de assinatura) e R$ 150,00
 * (gasto único) como se fossem comparáveis. Aqui os três viram impacto mensal,
 * e o valor da compra desce para contexto secundário.
 *
 * `menorNumeroParcela` é o menor número de parcela que a despesa possui, e
 * existe para separar dois casos que a tabela `despesa` não distingue: uma
 * parcelada criada do zero guarda em `valor_centavos` o preço da compra; uma
 * criada "em andamento" guarda o valor RESTANTE. Sem essa distinção, o saldo
 * devedor apareceria rotulado como preço de compra.
 */
export function descreverOcorrencia(
  despesa: DespesaDaOcorrencia,
  parcela: ParcelaDaOcorrencia,
  menorNumeroParcela: number
): Ocorrencia {
  const nasceuDoZero = menorNumeroParcela === 1

  return {
    impactoCentavos: parcela.valorCentavos,
    origemCentavos: despesa.tipo === 'Parcelada' && nasceuDoZero ? despesa.valorCentavos : null,
    rotuloParcela: rotular(despesa.tipo, parcela),
    progressoPct: parcela.total ? (parcela.numero / parcela.total) * 100 : null
  }
}

function rotular(tipo: TipoDespesa, parcela: ParcelaDaOcorrencia): string {
  if (tipo === 'Assinatura') return 'mensal'
  if (tipo === 'Unica') return 'à vista'
  // `total` é nullable no schema; sem ele, o número solto ainda informa mais
  // que "7/null".
  return parcela.total ? `${parcela.numero}/${parcela.total}` : String(parcela.numero)
}
