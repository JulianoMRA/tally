import type { FaturaComTotal } from '@shared/ipc/fatura'
import type { GrupoFaturasCartao } from './hooks/use-faturas'

function temFaturaAPagar(faturas: readonly FaturaComTotal[]): boolean {
  return faturas.some((f) => f.fatura.status.kind !== 'Paga' && f.totalCentavos > 0)
}

/**
 * Os cartões que o trilho mostra (RF-CAR-02, RF-FAT-06): todos os ativos e,
 * depois deles, o arquivado que ainda tem fatura a pagar — ou que está em foco.
 *
 * O em foco entra mesmo sem nada a pagar por dois caminhos: o link da Visão
 * mensal aponta para a fatura dele mesmo depois de paga, e pagar a última
 * fatura dele não pode tirar do trilho o cartão que o painel está mostrando.
 *
 * A tela carregava só os ativos. Arquivar um cartão com parcelas correndo
 * tirava as faturas dele de Faturas, mas não do saldo (RN-08), da Visão mensal
 * nem dos avisos do sistema: ninguém conseguia pagá-las, e o link da Visão
 * mensal caía em outro cartão avisando que a fatura não existia mais.
 */
export function cartoesDoTrilho(
  grupos: readonly GrupoFaturasCartao[],
  cartaoEmFocoId: number | null
): GrupoFaturasCartao[] {
  const ativos = grupos.filter((g) => g.cartao.ativo)
  const arquivados = grupos.filter(
    (g) => !g.cartao.ativo && (g.cartao.id === cartaoEmFocoId || temFaturaAPagar(g.faturas))
  )
  return [...ativos, ...arquivados]
}
