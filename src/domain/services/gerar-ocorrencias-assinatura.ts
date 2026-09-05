import type { Cartao } from '../entities/cartao'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from './calcular-fatura-da-compra'
import { clampDiaNoMes, mesReferenciaParaData, proxMesReferencia } from './mes-referencia'

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
  const { cartao, dataInicio, valorMensalCentavos, ocorrenciaInicial, quantidade } = input

  const primeiraRef = formatarMesReferencia(
    calcularReferenciaFaturaDaCompra(dataInicio, cartao.diaFechamento)
  )

  return gerarOcorrenciasAPartirDoMes({
    mesReferenciaInicial: primeiraRef,
    valorMensalCentavos,
    ocorrenciaInicial,
    quantidade
  })
}

export type GerarOcorrenciasAPartirDoMesInput = {
  /** Mês de referência "YYYY-MM" onde a PRIMEIRA ocorrência cai. */
  mesReferenciaInicial: string
  valorMensalCentavos: number
  ocorrenciaInicial?: number
  quantidade: number
}

const MES_REFERENCIA_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * RN-04 para quem JÁ sabe o mês de referência da primeira ocorrência.
 *
 * A extensão preguiçosa do horizonte (RF-VIS-04) conhece esse mês: ele sai do
 * `calcularExtensaoNecessaria`. Ela chamava `gerarOcorrenciasAssinatura`, o que
 * a obrigava a inventar uma data de compra (`YYYY-MM-01`) só para que a RN-01
 * fosse reaplicada sobre ela e devolvesse o mês de volta.
 *
 * A ida e volta não é neutra. A RN-01 manda a compra feita NO dia de
 * fechamento para a fatura seguinte, então com `diaFechamento = 1` o teste
 * `1 < 1` é falso e a série inteira desliza um mês — deixando um buraco
 * permanente, porque a chamada seguinte vê o último mês já além do alvo e não
 * gera nada.
 *
 * Mês de referência não é data de compra. Quem já tem o mês entra por aqui.
 */
export function gerarOcorrenciasAPartirDoMes(
  input: GerarOcorrenciasAPartirDoMesInput
): OcorrenciaPlanejada[] {
  const { mesReferenciaInicial, valorMensalCentavos, ocorrenciaInicial = 1, quantidade } = input

  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error(`quantidade deve ser inteiro >= 1, recebido: ${quantidade}`)
  }
  if (!Number.isInteger(ocorrenciaInicial) || ocorrenciaInicial < 1) {
    throw new Error(`ocorrenciaInicial deve ser inteiro >= 1, recebido: ${ocorrenciaInicial}`)
  }
  if (valorMensalCentavos <= 0) {
    throw new Error(`valorMensalCentavos deve ser > 0, recebido: ${valorMensalCentavos}`)
  }
  if (!MES_REFERENCIA_REGEX.test(mesReferenciaInicial)) {
    throw new Error(
      `mesReferenciaInicial inválido: '${mesReferenciaInicial}'. Esperado mês no formato YYYY-MM.`
    )
  }

  const ocorrencias: OcorrenciaPlanejada[] = []
  let mesRef = mesReferenciaInicial

  for (let i = 0; i < quantidade; i++) {
    ocorrencias.push({
      numero: ocorrenciaInicial + i,
      total: null,
      dataReferencia: mesReferenciaParaData(mesRef),
      valorCentavos: valorMensalCentavos
    })
    mesRef = proxMesReferencia(mesRef)
  }

  return ocorrencias
}

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/

export type GerarOcorrenciasSemCartaoInput = {
  /** Mês de referência "YYYY-MM" onde a PRIMEIRA ocorrência cai. */
  mesReferenciaInicial: string
  /** Dia do mês em que a despesa acontece (1..31). */
  diaCobranca: number
  valorMensalCentavos: number
  ocorrenciaInicial?: number
  quantidade: number
  /** Data limite "YYYY-MM-DD"; null ou ausente = recorre sempre (RF-DES-18). */
  recorreAte?: string | null
}

/**
 * RN-04, ramo SEM cartao (RF-DES-16) — despesa recorrente paga por Pix, debito
 * ou dinheiro.
 *
 * Duas diferencas em relacao ao ramo com cartao, e as duas tem motivo:
 *
 * 1. **O mes informado e o mes da primeira ocorrencia, sem passar pela RN-01.**
 *    Nao ha dia de fechamento a consultar. Reaplicar a RN-01 sobre um mes ja
 *    resolvido foi exatamente a origem do defeito do PR `#130`, onde um cartao
 *    com fechamento no dia 1 deslizava a serie inteira em um mes.
 *
 * 2. **A data e o dia de cobranca clampado no mes**, e nao o dia 01. Aqui a
 *    ocorrencia tem data propria — e o dia em que o dinheiro sai —, enquanto na
 *    assinatura de cartao quem tem data e o vencimento da fatura.
 *
 * O `diaCobranca` chega a cada chamada em vez de ser derivado da ocorrencia
 * anterior: o clamp de fevereiro nao pode contaminar marco (RF-DES-17).
 *
 * Funcao pura, sem I/O.
 */
export function gerarOcorrenciasSemCartao(
  input: GerarOcorrenciasSemCartaoInput
): OcorrenciaPlanejada[] {
  const {
    mesReferenciaInicial,
    diaCobranca,
    valorMensalCentavos,
    ocorrenciaInicial = 1,
    quantidade,
    recorreAte = null
  } = input

  if (!Number.isInteger(diaCobranca) || diaCobranca < 1 || diaCobranca > 31) {
    throw new Error(`diaCobranca deve ser inteiro entre 1 e 31, recebido: ${diaCobranca}`)
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error(`quantidade deve ser inteiro >= 1, recebido: ${quantidade}`)
  }
  if (!Number.isInteger(ocorrenciaInicial) || ocorrenciaInicial < 1) {
    throw new Error(`ocorrenciaInicial deve ser inteiro >= 1, recebido: ${ocorrenciaInicial}`)
  }
  if (valorMensalCentavos <= 0) {
    throw new Error(`valorMensalCentavos deve ser > 0, recebido: ${valorMensalCentavos}`)
  }
  if (!MES_REFERENCIA_REGEX.test(mesReferenciaInicial)) {
    throw new Error(
      `mesReferenciaInicial invalido: '${mesReferenciaInicial}'. Esperado mes no formato YYYY-MM.`
    )
  }
  if (recorreAte !== null && !DATA_ISO_REGEX.test(recorreAte)) {
    throw new Error(`recorreAte invalido: '${recorreAte}'. Esperado data no formato YYYY-MM-DD.`)
  }

  const ocorrencias: OcorrenciaPlanejada[] = []
  let mesRef = mesReferenciaInicial

  for (let i = 0; i < quantidade; i++) {
    const [ano, mes] = mesRef.split('-').map(Number)
    const dataReferencia = clampDiaNoMes(ano, mes, diaCobranca)

    // Comparacao pela data JA clampada: cobranca no dia 31 cai em 28 de
    // fevereiro, e com limite em 2026-02-28 essa ocorrencia cabe.
    // Comparacao de string funciona porque as duas sao ISO YYYY-MM-DD.
    if (recorreAte !== null && dataReferencia > recorreAte) break

    ocorrencias.push({
      numero: ocorrenciaInicial + i,
      total: null,
      dataReferencia,
      valorCentavos: valorMensalCentavos
    })
    mesRef = proxMesReferencia(mesRef)
  }

  return ocorrencias
}
