import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'

/** Uma seção da tabela de Saídas: o cabeçalho com subtotal e as linhas dele. */
export type GrupoOcorrencias = {
  /** `cartao-<id>`, `fora-do-cartao` ou `categoria-<id>`. Estável para usar como key. */
  chave: string
  rotulo: string
  /** Cor da bolinha: do cartão ou da categoria. Ausente em "Fora do cartão". */
  cor?: string
  /** Só no agrupamento por categoria: a arquivada leva o selo (RF-CAT-02). */
  arquivada?: boolean
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
 * Junta as ocorrências por chave, na ordem de primeira aparição, somando o
 * IMPACTO — nunca o valor de origem: é o que faz o subtotal de um cartão bater
 * com o total da fatura, e o de uma categoria com o ranking da Visão mensal.
 */
function juntarPorChave(
  itens: readonly OcorrenciaDoMes[],
  chaveDe: (o: OcorrenciaDoMes) => string,
  cabecalhoDe: (o: OcorrenciaDoMes) => Pick<GrupoOcorrencias, 'rotulo' | 'cor' | 'arquivada'>
): GrupoOcorrencias[] {
  const porChave = new Map<string, GrupoOcorrencias>()

  for (const item of itens) {
    const chave = chaveDe(item)
    const grupo = porChave.get(chave)

    if (grupo) {
      grupo.itens.push(item)
      grupo.totalCentavos += item.impactoCentavos
      continue
    }

    porChave.set(chave, {
      chave,
      ...cabecalhoDe(item),
      itens: [item],
      totalCentavos: item.impactoCentavos
    })
  }

  return [...porChave.values()]
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
export function agruparPorOrigem(
  itens: readonly OcorrenciaDoMes[],
  cartoes: readonly Cartao[]
): GrupoOcorrencias[] {
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]))

  const grupos = juntarPorChave(itens, chaveDeOrigem, (o) => {
    if (o.cartaoId === null) return { rotulo: 'Fora do cartão' }
    const cartao = cartaoPorId.get(o.cartaoId)
    return { rotulo: cartao?.nome ?? `#${o.cartaoId}`, cor: cartao?.cor }
  })

  return [
    ...grupos.filter((g) => g.chave !== FORA_DO_CARTAO),
    ...grupos.filter((g) => g.chave === FORA_DO_CARTAO)
  ]
}

/**
 * Agrupa as ocorrências do mês por categoria, da maior soma para a menor — a
 * ordem do ranking "Para onde foi" da Visão mensal, e com o mesmo número: as
 * duas contas recortam o mês pelo mesmo critério (fatura quando há, data de
 * referência quando não). Empate vai pelo nome.
 *
 * A ordem das linhas dentro de cada seção é a que chegou: é a ordenação
 * escolhida no cabeçalho, que age dentro dos grupos.
 */
export function agruparPorCategoria(
  itens: readonly OcorrenciaDoMes[],
  categorias: readonly Categoria[]
): GrupoOcorrencias[] {
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]))

  const grupos = juntarPorChave(
    itens,
    (o) => `categoria-${o.categoriaId}`,
    (o) => {
      const categoria = categoriaPorId.get(o.categoriaId)
      if (!categoria) return { rotulo: `#${o.categoriaId}` }
      return { rotulo: categoria.nome, cor: categoria.cor, arquivada: !categoria.ativo }
    }
  )

  return grupos.sort(
    (a, b) => b.totalCentavos - a.totalCentavos || a.rotulo.localeCompare(b.rotulo, 'pt-BR')
  )
}
