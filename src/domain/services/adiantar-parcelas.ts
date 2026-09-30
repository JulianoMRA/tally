import type { Parcela } from '../entities/parcela'
import type { Fatura } from '../entities/fatura'

export type ResultadoAdiantamento = {
  mover: Parcela[]
  razao?: 'insuficientes'
}

export function selecionarParcelasParaAdiantar(
  parcelas: Parcela[],
  faturasIndex: Map<number, Fatura>,
  quantidade: number,
  faturaDestino: Fatura
): ResultadoAdiantamento {
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error(`quantidade deve ser >= 1, recebido: ${quantidade}`)
  }
  if (faturaDestino.status.kind === 'Paga') {
    throw new Error('Não é possível adiantar parcelas para uma fatura já paga')
  }
  // RN-06: fatura Fechada é imutável — receber parcelas alteraria seu total.
  if (faturaDestino.status.kind === 'Fechada') {
    throw new Error('Não é possível adiantar parcelas para uma fatura fechada')
  }

  const elegiveis = parcelas
    .filter((p) => {
      if (p.status !== 'Pendente') return false
      if (p.faturaId === faturaDestino.id) return false
      const fat = p.faturaId === null ? undefined : faturasIndex.get(p.faturaId)
      if (fat && (fat.status.kind === 'Paga' || fat.status.kind === 'Fechada')) return false
      // RN-03: adiantar traz parcelas para uma fatura mais próxima, e nunca
      // leva uma parcela para depois. Sem a fatura no índice, o mês vem da
      // data de referência, que acompanha o mês da fatura (migration 0010).
      const mesDaParcela = fat?.mesReferencia ?? p.dataReferencia.slice(0, 7)
      return mesDaParcela > faturaDestino.mesReferencia
    })
    .sort((a, b) => b.numero - a.numero)

  const mover = elegiveis.slice(0, quantidade)
  const insuficientes = elegiveis.length < quantidade

  return {
    mover,
    ...(insuficientes ? { razao: 'insuficientes' as const } : {})
  }
}
