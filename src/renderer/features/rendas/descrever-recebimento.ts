import { diferencaEmDias } from '@domain/services/mes-referencia'
import type { PontoEvolucaoSaldo } from '@shared/ipc/relatorio'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { formatarDiaMes } from '../../lib/formatar-data'

export type DescricaoRecebimento = {
  /** Frase única de status. Substitui as duas colunas que se repetiam. */
  frase: string
  /** Dinheiro já na conta. Governa o ponto cheio vs. contorno tracejado. */
  realizado: boolean
  /** Previsto cuja data já passou. */
  atrasado: boolean
}

/**
 * RF-REN-07 — descreve o estado de um recebimento em uma frase.
 *
 * Ponto 15 do diagnóstico: a linha mostrava "esperada 05/08" numa coluna e
 * "Recebido 05/08/2026" na outra, duas colunas dizendo quase a mesma coisa. Aqui
 * vira uma frase só, e o que ela diz depende do que aconteceu — não de qual
 * campo está preenchido.
 */
export function descreverRecebimento(
  recebimento: RecebimentoComContexto,
  hoje: string
): DescricaoRecebimento {
  if (recebimento.status === 'Recebido') {
    // `dataRecebida` é nullable no schema: sem ela não dá para afirmar um dia,
    // mas o dinheiro está na conta do mesmo jeito.
    const quando = recebimento.dataRecebida ? ` em ${formatarDiaMes(recebimento.dataRecebida)}` : ''
    return { frase: `na conta${quando}`, realizado: true, atrasado: false }
  }

  const dia = formatarDiaMes(recebimento.dataEsperada)
  const dias = diferencaEmDias(hoje, recebimento.dataEsperada)

  if (dias === 0) return { frase: 'previsto para hoje', realizado: false, atrasado: false }

  if (dias > 0) {
    const sufixo = dias === 1 ? 'em 1 dia' : `em ${dias} dias`
    return { frase: `previsto para ${dia} · ${sufixo}`, realizado: false, atrasado: false }
  }

  // Entrada que não caiu na data é o caso que precisa de atenção: a frase
  // denuncia em vez de dizer "previsto" como se ainda estivesse no prazo.
  const atraso = -dias
  const sufixo = atraso === 1 ? 'atrasado 1 dia' : `atrasado ${atraso} dias`
  return { frase: `previsto para ${dia} · ${sufixo}`, realizado: false, atrasado: true }
}

export type ProgressoDoMes = {
  recebidoCentavos: number
  previstoCentavos: number
  totalCentavos: number
  /** Fatia já na conta, 0–100. Largura da parte sólida da barra. */
  recebidoPct: number
  entradasPendentes: number
}

/**
 * RF-REN-08 — o progresso do mês numa barra.
 *
 * Substitui os três cards de peso igual (Esperado / Recebido / Total) que o
 * ponto 15 acusa de não fecharem a conta: "Esperado R$ 700" ao lado de
 * "Recebido R$ 1.400" e "Total R$ 2.100" não se lê como soma. Aqui o esperado
 * deixa de ser um card isolado e vira a parte clara da barra.
 */
export function montarProgressoDoMes(
  recebimentos: readonly RecebimentoComContexto[]
): ProgressoDoMes {
  let recebidoCentavos = 0
  let previstoCentavos = 0
  let entradasPendentes = 0

  for (const r of recebimentos) {
    if (r.status === 'Recebido') {
      recebidoCentavos += r.valorCentavos
      continue
    }
    previstoCentavos += r.valorCentavos
    entradasPendentes += 1
  }

  const totalCentavos = recebidoCentavos + previstoCentavos

  return {
    recebidoCentavos,
    previstoCentavos,
    totalCentavos,
    recebidoPct: totalCentavos > 0 ? (recebidoCentavos / totalCentavos) * 100 : 0,
    entradasPendentes
  }
}

/**
 * Média de entradas dos meses anteriores, como referência para o total do mês.
 *
 * R$ 2.100 não significa nada sozinho; comparado a uma média de R$ 1.983 vira
 * informação. Reaproveita a série que a aba Análise já calcula.
 *
 * `mesCorrente` sai da conta porque ainda está em curso: incluí-lo puxaria a
 * média para baixo e faria a comparação parecer favorável todo mês.
 */
export function mediaDeEntradas(
  serie: readonly PontoEvolucaoSaldo[],
  mesCorrente?: string
): number | null {
  const anteriores = mesCorrente ? serie.filter((p) => p.mes !== mesCorrente) : serie
  if (anteriores.length === 0) return null

  const soma = anteriores.reduce((s, p) => s + p.entradasCentavos, 0)
  // Base sem histórico de entradas: os meses existem na série mas somam zero.
  // "média R$ 0,00" não é referência de nada — faria qualquer mês parecer
  // excepcional. Sem comparação é melhor que uma comparação vazia.
  if (soma === 0) return null

  return Math.round(soma / anteriores.length)
}
