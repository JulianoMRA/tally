import type { DespesaComTags } from '@shared/ipc/despesa'
import { centavosParaReais } from '../../lib/dinheiro'

// Pré-preenchimento do DespesaForm ao duplicar uma saída. Discriminado pela
// aba do formulário. `dataCompra` NÃO é copiada (duplicar = nova compra hoje);
// assinatura em andamento não é duplicável como "em-andamento" — vira nova.

/**
 * As tags acompanham a cópia (RF-DES-11): elas classificam o gasto, e uma
 * compra repetida cai na mesma classificação. A NOTA não vem junto — ela
 * costuma ser sobre aquele lançamento específico ("reembolsável pela viagem de
 * março"), e herdar texto assim seria afirmar algo que o usuário não escreveu
 * para esta compra.
 */
type ComTags = { tags: string[] }

export type PreenchimentoUnica = ComTags & {
  tipo: 'unica'
  forma: 'Credito' | 'Pix' | 'Debito' | 'Dinheiro'
  descricao: string
  categoriaId: number
  cartaoId: number | null
  valorReais: string
}

export type PreenchimentoParcelada = ComTags & {
  tipo: 'parcelada'
  descricao: string
  categoriaId: number
  cartaoId: number | null
  valorReais: string
  totalParcelas: number | null
}

export type PreenchimentoAssinatura = ComTags & {
  tipo: 'assinatura'
  descricao: string
  categoriaId: number
  cartaoId: number | null
  valorReais: string
}

export type PreenchimentoDespesa =
  | PreenchimentoUnica
  | PreenchimentoParcelada
  | PreenchimentoAssinatura

/**
 * Mapeia uma despesa existente para os valores iniciais do formulário de nova
 * despesa. Pura — a descrição ganha sufixo " (cópia)" para deixar claro que é
 * um novo lançamento.
 */
export function montarPreenchimentoDespesa(despesa: DespesaComTags): PreenchimentoDespesa {
  const descricao = `${despesa.descricao} (cópia)`
  // `centavosParaReais`, não `formatarValorCsv`: o destino é um campo de tela,
  // e a gramática do formulário garante que o campo abre com um texto que ele
  // próprio aceita de volta. O formatador do CSV produz o mesmo texto para
  // valor positivo — nunca houve defeito visível —, mas é a gramática do outro
  // lado do app, e o PR #116 unificou a leitura de valor justamente para que
  // essas duas não voltassem a divergir em silêncio.
  const valorReais = centavosParaReais(despesa.valorCentavos)

  if (despesa.tipo === 'Assinatura') {
    return {
      tipo: 'assinatura',
      descricao,
      categoriaId: despesa.categoriaId,
      cartaoId: despesa.cartaoId,
      valorReais,
      tags: despesa.tags
    }
  }
  if (despesa.tipo === 'Parcelada') {
    return {
      tipo: 'parcelada',
      descricao,
      categoriaId: despesa.categoriaId,
      cartaoId: despesa.cartaoId,
      valorReais,
      totalParcelas: despesa.totalParcelas,
      tags: despesa.tags
    }
  }
  return {
    tipo: 'unica',
    forma: despesa.formaPagamento,
    descricao,
    categoriaId: despesa.categoriaId,
    cartaoId: despesa.cartaoId,
    valorReais,
    tags: despesa.tags
  }
}
