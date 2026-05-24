import type { Cartao } from '../entities/cartao'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from './calcular-fatura-da-compra'
import { proxMesReferencia } from './mes-referencia'

export type OcorrenciaPlanejada = {
  numero: number
  total: null
  dataReferencia: string
  valorCentavos: number
}

export type GerarOcorrenciasAssinaturaInput = {
  cartao: Cartao
  dataInicio: string
  valorMensalCentavos: number
  ocorrenciaInicial?: number
  quantidade: number
}

/**
 * RN-04 — gera ocorrências mensais de uma assinatura.
 *
 * A primeira ocorrência cai na fatura calculada via RN-01 a partir de `dataInicio`.
 * Cada ocorrência subsequente cai no mês de referência seguinte. Todas têm
 * `total = null` (assinatura sem fim definido). O parâmetro `ocorrenciaInicial`
 * permite estender o horizonte preguiçosamente sem reiniciar a numeração — uso
 * previsto pelo Slice 12 (multi-mês e projeção).
 */
export function gerarOcorrenciasAssinatura(
  input: GerarOcorrenciasAssinaturaInput
): OcorrenciaPlanejada[] {
  const { cartao, dataInicio, valorMensalCentavos, ocorrenciaInicial = 1, quantidade } = input

  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error(`quantidade deve ser inteiro >= 1, recebido: ${quantidade}`)
  }
  if (!Number.isInteger(ocorrenciaInicial) || ocorrenciaInicial < 1) {
    throw new Error(`ocorrenciaInicial deve ser inteiro >= 1, recebido: ${ocorrenciaInicial}`)
  }
  if (valorMensalCentavos <= 0) {
    throw new Error(`valorMensalCentavos deve ser > 0, recebido: ${valorMensalCentavos}`)
  }

  const primeiraRef = formatarMesReferencia(
    calcularReferenciaFaturaDaCompra(dataInicio, cartao.diaFechamento)
  )

  const ocorrencias: OcorrenciaPlanejada[] = []
  let mesRef = primeiraRef

  for (let i = 0; i < quantidade; i++) {
    ocorrencias.push({
      numero: ocorrenciaInicial + i,
      total: null,
      dataReferencia: `${mesRef}-01`,
      valorCentavos: valorMensalCentavos
    })
    mesRef = proxMesReferencia(mesRef)
  }

  return ocorrencias
}
