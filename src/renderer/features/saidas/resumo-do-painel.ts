import { pluralizar } from '../../lib/pluralizar'

export type ResumoDoPainel = {
  /** "79 lançamentos", ou "12 de 79 lançamentos" quando algo ficou de fora. */
  contagem: string
  totalCentavos: number
}

/**
 * O que o topo do painel de Saídas diz ao lado do título.
 *
 * Era "79 · R$ 3.965,96": o número mais importante da tela em cinza pequeno,
 * sem rótulo, repetindo a contagem da aba "Todas" — e sem dizer se a lista
 * estava inteira. Com filtro, a contagem passa a dizer quanto ficou de fora.
 * O total é o das linhas visíveis, como antes.
 *
 * Mês sem lançamento não tem resumo: o estado vazio já diz isso.
 */
export function resumoDoPainel(
  visiveis: number,
  noMes: number,
  totalCentavos: number
): ResumoDoPainel | null {
  if (noMes === 0) return null
  const lancamentos = pluralizar('lançamento', noMes)
  const contagem =
    visiveis === noMes ? `${noMes} ${lancamentos}` : `${visiveis} de ${noMes} ${lancamentos}`
  return { contagem, totalCentavos }
}
