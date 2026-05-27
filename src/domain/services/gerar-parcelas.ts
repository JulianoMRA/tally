import type { Cartao } from '../entities/cartao'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia
} from './calcular-fatura-da-compra'
import { proxMesReferencia } from './mes-referencia'

// Slice 15: parcela.dataReferencia agora e sempre YYYY-MM-DD (dia 01 para
// parcelas geradas a partir de mes de referencia). Antes co-existiam dois
// formatos na mesma coluna; agora a coluna e homogenea.
function mesRefParaData(mesRef: string): string {
  return `${mesRef}-01`
}

export type ParcelaPlanejada = {
  numero: number
  total: number
  dataReferencia: string
  valorCentavos: number
}

export type GerarParcelasInput = {
  cartao: Cartao
  dataCompra: string
  totalParcelas: number
  parcelaInicial?: number
  valorTotalCentavos: number
}

function distribuirCentavos(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  const resto = total - base * n
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? base : base + resto))
}

export function gerarParcelas(input: GerarParcelasInput): ParcelaPlanejada[] {
  const { cartao, dataCompra, totalParcelas, parcelaInicial = 1, valorTotalCentavos } = input

  if (!Number.isInteger(totalParcelas) || totalParcelas < 1) {
    throw new Error(`totalParcelas deve ser >= 1, recebido: ${totalParcelas}`)
  }
  if (!Number.isInteger(parcelaInicial) || parcelaInicial < 1) {
    throw new Error(`parcelaInicial deve ser >= 1, recebido: ${parcelaInicial}`)
  }
  if (parcelaInicial > totalParcelas) {
    throw new Error(
      `parcelaInicial (${parcelaInicial}) não pode ser maior que totalParcelas (${totalParcelas})`
    )
  }
  if (valorTotalCentavos <= 0) {
    throw new Error(`valorTotalCentavos deve ser > 0, recebido: ${valorTotalCentavos}`)
  }

  const quantidade = totalParcelas - parcelaInicial + 1
  const valores = distribuirCentavos(valorTotalCentavos, quantidade)

  const primeiraRef = formatarMesReferencia(
    calcularReferenciaFaturaDaCompra(dataCompra, cartao.diaFechamento)
  )

  const parcelas: ParcelaPlanejada[] = []
  let mesRef = primeiraRef

  for (let i = 0; i < quantidade; i++) {
    parcelas.push({
      numero: parcelaInicial + i,
      total: totalParcelas,
      dataReferencia: mesRefParaData(mesRef),
      valorCentavos: valores[i]
    })
    mesRef = proxMesReferencia(mesRef)
  }

  return parcelas
}
