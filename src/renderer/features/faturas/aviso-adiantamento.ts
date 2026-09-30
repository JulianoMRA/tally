import type { ToastKind } from '../../components/ui'
import { pluralizar } from '../../lib/pluralizar'

/**
 * O aviso depois de adiantar parcelas (RN-03), a partir do que o main de fato
 * moveu. O aviso antigo repetia a quantidade pedida — "5 parcela(s)
 * adiantada(s)." — mesmo quando só 2 eram elegíveis, ou nenhuma.
 */
export function avisoDoAdiantamento(
  movidas: number,
  pedidas: number
): { texto: string; tipo: ToastKind } {
  if (movidas === 0) {
    return { texto: 'Nenhuma parcela para adiantar para esta fatura.', tipo: 'info' }
  }
  if (movidas === pedidas) {
    const texto = `${movidas} ${pluralizar('parcela', movidas)} ${pluralizar('adiantada', movidas)}.`
    return { texto, tipo: 'success' }
  }
  // "1 de 3 parcelas adiantadas": a concordância é com o total pedido.
  return { texto: `${movidas} de ${pedidas} parcelas adiantadas.`, tipo: 'success' }
}
