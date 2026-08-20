import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { formatarDataIso } from '../../lib/formatar-data'

export type DataDaOcorrencia = {
  /** O que a célula exibe. */
  texto: string
  /** Tom secundário: não é um evento datado do mês, é referência de origem. */
  apoio: boolean
}

/**
 * Descreve a data de uma ocorrência para a coluna "Compra".
 *
 * A coluna se chama Compra e não Data de propósito: ela responde **quando o
 * compromisso nasceu**, não quando o dinheiro sai. A segunda pergunta é do
 * agrupamento por cartão e da tela de Faturas, e duplicá-la aqui só criaria
 * duas datas na mesma linha dizendo coisas parecidas — que é o defeito que a F6
 * corrigiu em Rendas.
 *
 * A F4 tinha removido a data da tela argumentando que "a parcela 7/12 de uma
 * compra de sete meses atrás não aconteceu em dia nenhum do mês exibido". O
 * argumento vale para AGRUPAR por dia, e por isso o agrupamento por origem
 * ficou. Não vale para exibir: saber que a parcela vem de uma compra de
 * fevereiro é justamente o contexto que faltava na linha.
 */
export function descreverDataDaOcorrencia(ocorrencia: OcorrenciaDoMes): DataDaOcorrencia {
  if (!ocorrencia.dataCompra) return { texto: '—', apoio: true }

  // Assinatura não tem data de compra no sentido das outras: o início pode ser
  // de anos atrás, e repetir o dia como se fosse um evento do mês mentiria.
  // Mês e ano bastam para situar desde quando ela corre.
  if (ocorrencia.tipo === 'Assinatura') {
    const [ano, mes] = ocorrencia.dataCompra.split('-')
    return { texto: `desde ${mes}/${ano}`, apoio: true }
  }

  return { texto: formatarDataIso(ocorrencia.dataCompra), apoio: false }
}

/**
 * Se a lista deve agrupar por cartão, dada a coluna de ordenação ativa.
 *
 * Os dois recortes brigam: o agrupamento por origem faz o subtotal reconciliar
 * com o total da fatura (decisão da F4, e é o padrão da tela), mas enquanto ele
 * vale a ordenação só age DENTRO de cada grupo — "o mês inteiro em ordem
 * cronológica" simplesmente não existia.
 *
 * Ordenar por Compra é o pedido explícito por essa leitura, então ela achata os
 * grupos. Qualquer outra ordenação devolve o agrupamento: sem a volta, o
 * subtotal por cartão viraria uma função de mão única.
 */
export function agruparSeAplicavel(sortBy: string): boolean {
  return sortBy !== 'compra'
}
