import type { FaturaComTotal } from '@shared/ipc/fatura'

export type ResumoCartao = {
  /**
   * Total da fatura do mês corrente, ou null quando não há fatura no mês.
   *
   * É a fatura DO MÊS, qualquer que seja o status dela — o nome anterior
   * (`abertura`) sugeria fatura Aberta, e a tela repetia a sugestão num rótulo
   * que continuava dizendo "Fatura aberta" depois de fechada ou paga.
   */
  faturaDoMesCentavos: number | null
  /** Últimos 6 meses encerrados, do mais antigo ao mais recente. */
  serie: { mes: string; totalCentavos: number }[]
  /** Média dos meses da série. Null quando não há histórico. */
  mediaCentavos: number | null
  /** Meses da série em que o cartão foi usado. */
  mesesComUso: number
}

const MESES_DA_SERIE = 6

/**
 * RF-CAR-04 — o que a linha do cartão passa a dizer.
 *
 * Ponto 13 aplicado à tela de configuração: hoje a linha traz nome, dias e um
 * badge "Ativo" que nunca é falso na visão padrão — cadastro morto. Com fatura
 * aberta, série de 6 meses e frequência de uso, a tela vira leitura.
 *
 * Deriva tudo de `listarResumoPorCartao`, que a tela de Faturas já consome:
 * nenhuma consulta nova.
 */
export function resumirCartao(faturas: readonly FaturaComTotal[], mesAtual: string): ResumoCartao {
  const doMes = faturas.find((f) => f.mesReferencia === mesAtual)

  // Só meses ENCERRADOS entram na série: o corrente ainda está recebendo
  // compras e puxaria a média para baixo todo mês.
  const encerrados = faturas
    .filter((f) => f.mesReferencia < mesAtual)
    .sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia))

  const serie = encerrados
    .slice(-MESES_DA_SERIE)
    .map((f) => ({ mes: f.mesReferencia, totalCentavos: f.totalCentavos }))

  const soma = serie.reduce((s, p) => s + p.totalCentavos, 0)

  return {
    faturaDoMesCentavos: doMes ? doMes.totalCentavos : null,
    serie,
    // Sem histórico não há média; e histórico que soma zero não é referência
    // de nada — mesmo raciocínio de `mediaDeEntradas` em Rendas.
    mediaCentavos: serie.length > 0 && soma > 0 ? Math.round(soma / serie.length) : null,
    mesesComUso: serie.filter((p) => p.totalCentavos > 0).length
  }
}

/**
 * Altura relativa de cada barra da sparkline, 0–100, escalada pelo maior mês.
 * Mês zerado devolve 0 — a barra some, que é a leitura certa para "não usei".
 */
export function alturasDaSparkline(serie: readonly { totalCentavos: number }[]): number[] {
  const maior = serie.reduce((m, p) => Math.max(m, p.totalCentavos), 0)
  if (maior === 0) return serie.map(() => 0)
  return serie.map((p) => (p.totalCentavos / maior) * 100)
}
