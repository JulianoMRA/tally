import type { StatusFatura } from '../entities/fatura'
import type { StatusRecebimento } from '../entities/recebimento'

export type FaturaParaAgenda = {
  cartaoNome: string
  cartaoCor: string
  /** RN-10 — o que falta pagar: o total menos os pagamentos parciais. */
  restanteCentavos: number
  /** RN-10 — soma dos pagamentos parciais; zero quando não há nenhum. */
  pagoParcialCentavos: number
  dataFechamento: string
  dataVencimento: string
  status: StatusFatura
}

export type RecebimentoParaAgenda = {
  fonte: string | null
  dataEsperada: string
  valorCentavos: number
  status: StatusRecebimento
}

export type EventoAgenda =
  | {
      kind: 'FechamentoFatura'
      data: string
      cartaoNome: string
      cartaoCor: string
      restanteCentavos: number
      /** O valor já vem abatido: quem exibe não pode chamá-lo de acumulado. */
      temPagamentoParcial: boolean
    }
  | {
      kind: 'VencimentoFatura'
      data: string
      cartaoNome: string
      cartaoCor: string
      restanteCentavos: number
    }
  | { kind: 'RecebimentoPrevisto'; data: string; fonte: string | null; valorCentavos: number }

export type AgendaInput = {
  faturas: readonly FaturaParaAgenda[]
  recebimentos: readonly RecebimentoParaAgenda[]
  hoje: string
}

/**
 * RF-VIS-07 — o que ainda vai acontecer no horizonte visível.
 *
 * O saldo projetado (RN-08) soma entradas que ainda não caíram e saídas de
 * faturas que ainda não venceram, mas não mostra QUAIS. Sem essa lista o
 * número só pode ser aceito, não conferido. Cada evento aqui é uma parcela
 * daquela projeção.
 *
 * A fatura entra pelo que falta pagar (RN-10), que é quanto ela pesa na RN-08.
 * Com o total, a agenda anunciaria no vencimento uma saída maior que a cobrada,
 * e a soma dos eventos deixaria de bater com a sobra projetada.
 *
 * Datas são `YYYY-MM-DD` e comparam lexicograficamente — mesmo contrato de
 * `precisaAutoFechar`, e o motivo de o domínio não precisar de biblioteca de
 * data (regra 8).
 */
export function montarAgendaDoMes(input: AgendaInput): EventoAgenda[] {
  const eventos: EventoAgenda[] = []

  for (const fatura of input.faturas) {
    // Paga não move mais o saldo; zerada nunca moveu, e a que os pagamentos
    // parciais já cobriram não tem mais o que mover. O trilho de cartões ainda
    // mostra as três — a agenda é só sobre o que está por vir.
    if (fatura.status.kind === 'Paga' || fatura.restanteCentavos === 0) continue

    const { cartaoNome, cartaoCor, restanteCentavos } = fatura

    // Fechada já fechou, mesmo que `dataFechamento` esteja no futuro: um
    // fechamento manual antecipado não agenda um segundo fechamento.
    if (fatura.status.kind === 'Aberta' && fatura.dataFechamento >= input.hoje) {
      eventos.push({
        kind: 'FechamentoFatura',
        data: fatura.dataFechamento,
        cartaoNome,
        cartaoCor,
        restanteCentavos,
        temPagamentoParcial: fatura.pagoParcialCentavos > 0
      })
    }

    if (fatura.dataVencimento >= input.hoje) {
      eventos.push({
        kind: 'VencimentoFatura',
        data: fatura.dataVencimento,
        cartaoNome,
        cartaoCor,
        restanteCentavos
      })
    }
  }

  for (const recebimento of input.recebimentos) {
    if (recebimento.status === 'Recebido') continue
    if (recebimento.dataEsperada < input.hoje) continue

    eventos.push({
      kind: 'RecebimentoPrevisto',
      data: recebimento.dataEsperada,
      fonte: recebimento.fonte,
      valorCentavos: recebimento.valorCentavos
    })
  }

  // `sort` do V8 é estável desde o ES2019: empate de data preserva a ordem de
  // entrada, então fechamento vem antes de vencimento do mesmo cartão e as
  // faturas antes dos recebimentos do mesmo dia.
  return eventos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}
