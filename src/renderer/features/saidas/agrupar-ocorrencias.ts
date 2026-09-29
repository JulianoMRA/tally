import type { OcorrenciaDoMes } from '@shared/ipc/despesa'

export type GrupoOcorrencias = {
  /** `cartao-<id>` ou `fora-do-cartao`. Estável para usar como key. */
  chave: string
  rotulo: string
  cartaoId: number | null
  itens: OcorrenciaDoMes[]
  totalCentavos: number
}

export const FORA_DO_CARTAO = 'fora-do-cartao'

/**
 * Chave da origem do dinheiro: `cartao-<id>` ou `fora-do-cartao`. É a mesma no
 * agrupamento e no filtro de origem — "Fora do cartão" tem um significado só
 * na tela, o que não tem cartão, e inclui a recorrente no Pix.
 */
export function chaveDeOrigem(ocorrencia: Pick<OcorrenciaDoMes, 'cartaoId'>): string {
  return ocorrencia.cartaoId === null ? FORA_DO_CARTAO : `cartao-${ocorrencia.cartaoId}`
}

/**
 * Agrupa as ocorrências do mês por origem do dinheiro: uma seção por cartão
 * (a fatura daquele mês) e uma para o que sai direto da conta.
 *
 * Não é agrupamento por dia. Enquanto a linha era uma compra, o dia respondia
 * "quanto gastei naquele sábado"; agora a linha é uma OCORRÊNCIA, e a parcela
 * 7/12 de um notebook comprado sete meses atrás não aconteceu em dia nenhum
 * deste mês — ela pertence a uma fatura. Agrupar por origem também faz o
 * subtotal de cada cartão bater com o total da fatura na tela de Faturas.
 *
 * A ordem dos grupos segue a primeira aparição, que a consulta já entrega
 * ordenada por data de compra; "Fora do cartão" é empurrado para o fim por ser
 * o único que não tem prazo de fechamento a acompanhar.
 */
export function agruparOcorrencias(
  itens: readonly OcorrenciaDoMes[],
  nomeCartao: (id: number) => string
): GrupoOcorrencias[] {
  const porChave = new Map<string, GrupoOcorrencias>()

  for (const item of itens) {
    const chave = chaveDeOrigem(item)
    const grupo = porChave.get(chave)

    if (grupo) {
      grupo.itens.push(item)
      grupo.totalCentavos += item.impactoCentavos
      continue
    }

    porChave.set(chave, {
      chave,
      rotulo: item.cartaoId === null ? 'Fora do cartão' : nomeCartao(item.cartaoId),
      cartaoId: item.cartaoId,
      itens: [item],
      totalCentavos: item.impactoCentavos
    })
  }

  const grupos = [...porChave.values()]
  return [
    ...grupos.filter((g) => g.chave !== FORA_DO_CARTAO),
    ...grupos.filter((g) => g.chave === FORA_DO_CARTAO)
  ]
}
