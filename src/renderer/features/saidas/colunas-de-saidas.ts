import type { Cartao } from '@domain/entities/cartao'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'

/** Como a tabela de Saídas se divide em seções (RF-DES-14). */
export type Agrupamento = 'origem' | 'categoria' | 'nenhum'

export type ColunaDeSaidas =
  | 'descricao'
  | 'categoria'
  | 'origem'
  | 'compra'
  | 'parcela'
  | 'valor'
  | 'acoes'

/**
 * As colunas acompanham o agrupamento: sai a que a seção torna repetida, entra
 * a informação que a seção deixa de mostrar. Agrupada por categoria, a coluna
 * Categoria diria o mesmo do cabeçalho em toda linha — e sem uma coluna Origem
 * nada diria de que cartão é cada lançamento. Sem agrupamento, as duas.
 */
export function colunasDoAgrupamento(agrupamento: Agrupamento): ColunaDeSaidas[] {
  switch (agrupamento) {
    case 'origem':
      return ['descricao', 'categoria', 'compra', 'parcela', 'valor', 'acoes']
    case 'categoria':
      return ['descricao', 'origem', 'compra', 'parcela', 'valor', 'acoes']
    case 'nenhum':
      return ['descricao', 'categoria', 'origem', 'compra', 'parcela', 'valor', 'acoes']
  }
}

const ROTULO_DA_FORMA: Record<OcorrenciaDoMes['formaPagamento'], string> = {
  Credito: 'Crédito',
  Debito: 'Débito',
  Pix: 'Pix',
  Dinheiro: 'Dinheiro'
}

/**
 * O que a coluna Origem mostra: o cartão, com a cor dele, ou — sem cartão — a
 * forma de pagamento. Aqui "Pix" diz mais que "Fora do cartão", que é a classe
 * que o filtro e o agrupamento usam.
 */
export function origemDaOcorrencia(
  ocorrencia: Pick<OcorrenciaDoMes, 'cartaoId' | 'formaPagamento'>,
  cartaoPorId: ReadonlyMap<number, Cartao>
): { texto: string; cor?: string } {
  if (ocorrencia.cartaoId === null) return { texto: ROTULO_DA_FORMA[ocorrencia.formaPagamento] }
  const cartao = cartaoPorId.get(ocorrencia.cartaoId)
  return cartao ? { texto: cartao.nome, cor: cartao.cor } : { texto: `#${ocorrencia.cartaoId}` }
}
