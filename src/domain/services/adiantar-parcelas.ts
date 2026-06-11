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
      if (p.faturaId === null) return true
      const fat = faturasIndex.get(p.faturaId)
      if (!fat) return true
      return fat.status.kind !== 'Paga' && fat.status.kind !== 'Fechada'
    })
    .sort((a, b) => b.numero - a.numero)

  const mover = elegiveis.slice(0, quantidade)
  const insuficientes = elegiveis.length < quantidade

  return {
    mover,
    ...(insuficientes ? { razao: 'insuficientes' as const } : {})
  }
}
