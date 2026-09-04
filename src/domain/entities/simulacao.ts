/**
 * Simulação (RF-SIM): hipóteses de gasto e entrada sobre o saldo de um mês.
 *
 * Nada aqui é dado financeiro real. Um item de simulação não vira despesa,
 * parcela, fatura nem recebimento, não entra na RN-08 e não mora no SQLite —
 * é rascunho, e a única coisa que ele move é o número da própria tela.
 */

/** O sinal do item vem daqui, nunca do valor. Ver o invariante em `ItemSimulacao`. */
export type TipoItemSimulacao = 'entrada' | 'saida'

export type ItemSimulacao = {
  /** Gerado no renderer (`crypto.randomUUID`); só precisa ser estável dentro do mês. */
  id: string
  descricao: string
  /**
   * Sempre positivo. Valor monetário negativo não é representável no projeto
   * (decisão de ago/2026): quem diz se soma ou subtrai é o `tipo`.
   */
  valorCentavos: number
  /** Quantas vezes o item acontece no mês (1 a 99). "100 por fim de semana" é 100 com 4. */
  repeticoes: number
  tipo: TipoItemSimulacao
  /** Desligado sai da conta sem sair da lista — é o que torna a tela um "e se". */
  ativo: boolean
}

/**
 * De onde a simulação parte (RF-SIM-03). `mes` usa a sobra projetada do mês
 * (RN-08), que o app calcula; `manual` usa um valor digitado, porque o Tally
 * não tem saldo de conta — só fluxo mensal — e "tenho 200 na conta hoje" não é
 * derivável de nada que ele guarda.
 */
export type ModoBaseSimulacao = 'mes' | 'manual'

export type BaseSimulacao = {
  modo: ModoBaseSimulacao
  /** Preservado ao alternar para `mes`, para ir e voltar não perder o número digitado. */
  valorManualCentavos: number
}

export type SimulacaoDoMes = {
  base: BaseSimulacao
  itens: ItemSimulacao[]
}
