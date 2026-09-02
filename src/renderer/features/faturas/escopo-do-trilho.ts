/**
 * O card do trilho mostra sempre a fatura CORRENTE do cartão, mesmo enquanto o
 * painel navega por outros meses — é a decisão de RF-FAT-06, e ela existe
 * porque a pergunta do trilho é "como cada cartão está hoje".
 *
 * O que faltava era dizer isso na tela. Card e painel são vizinhos, o card é
 * também o seletor do painel (`aria-pressed`, borda de foco), e seleção cria
 * expectativa de identidade: o que está aceso em cima deveria ser o que está
 * aberto embaixo. Quando os dois meses divergem, dois totais diferentes
 * convivem sem nada explicando a diferença — e a leitura é de defeito.
 *
 * Devolve o mês que o painel está exibindo quando ele saiu da fatura corrente
 * do cartão; null quando não há divergência a declarar.
 *
 * Só o cartão em foco entra: o painel é de um cartão só, então card não
 * selecionado não tem par com que divergir, e marcar todos viraria ruído.
 */
export function mesDivergenteDoPainel(
  mesDaCorrente: string | null,
  mesDoPainel: string | null,
  emFoco: boolean
): string | null {
  if (!emFoco) return null
  if (mesDaCorrente === null || mesDoPainel === null) return null
  if (mesDaCorrente === mesDoPainel) return null
  return mesDoPainel
}
