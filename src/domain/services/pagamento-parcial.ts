import type { StatusFatura } from '../entities/fatura'
import { diasNoMes } from './mes-referencia'

export type RestanteDaFatura = {
  /** Soma das parcelas (RN-07): quanto foi comprado. */
  totalCentavos: number
  /** Soma dos pagamentos parciais. */
  pagoParcialCentavos: number
  /** O que falta pagar. Nunca negativo. */
  restanteCentavos: number
  /** O que os pagamentos parciais passam do total. */
  excedenteCentavos: number
}

function exigirCentavos(valor: number, campo: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${campo} deve ser inteiro em centavos, sem sinal. Recebido: ${valor}.`)
  }
}

/**
 * RN-10 — quanto falta pagar de uma fatura.
 *
 *   falta pagar = max(0, total − pagamentos parciais)
 *
 * É o valor da fatura para a tela e para a sobra do mês (RN-08). O total
 * continua sendo a soma das parcelas (RN-07) e não muda com pagamento: gasto
 * por categoria, lista de Saídas e uso do cartão seguem por ele.
 *
 * O restante nunca fica negativo. Os parciais só passam do total numa fatura
 * Aberta, quando uma despesa é excluída ou reduzida depois do pagamento, e a
 * diferença sai em `excedenteCentavos` — valor negativo não é representável no
 * projeto. As guardas tornam esse invariante explícito aqui, e não só nos CHECK
 * do banco.
 *
 * Os três pontos que leem o total de uma fatura (resumo por cartão, detalhe e
 * visão mensal) passam por esta função: três contas próprias fariam a mesma
 * fatura valer um número em cada tela.
 */
export function calcularRestanteDaFatura(
  totalCentavos: number,
  pagoParcialCentavos: number
): RestanteDaFatura {
  exigirCentavos(totalCentavos, 'totalCentavos')
  exigirCentavos(pagoParcialCentavos, 'pagoParcialCentavos')

  return {
    totalCentavos,
    pagoParcialCentavos,
    restanteCentavos: Math.max(0, totalCentavos - pagoParcialCentavos),
    excedenteCentavos: Math.max(0, pagoParcialCentavos - totalCentavos)
  }
}

/**
 * RN-10 — fatura cujos pagamentos parciais já cobrem o total: não há o que
 * pagar, só o que marcar. É o sinal que desliga os avisos de vencimento, na
 * tela ("vence em N dias", "vencida há N dias") e na notificação do sistema.
 *
 * Exige pagamento de fato. Fatura sem compra também tem restante zero, e
 * tratá-la como quitada desligaria os avisos de uma fatura vazia de cartão
 * ativo, que hoje avisam.
 */
export function quitadaPorParciais(
  fatura: Pick<RestanteDaFatura, 'pagoParcialCentavos' | 'restanteCentavos'>
): boolean {
  return fatura.pagoParcialCentavos > 0 && fatura.restanteCentavos === 0
}

/** O mínimo que decide o registro: onde a fatura está e quanto ainda falta. */
export type PagamentoParaRegistrar = {
  statusFatura: StatusFatura['kind']
  restanteCentavos: number
  valorCentavos: number
  dataPagamento: string
}

export type MotivoRecusaPagamentoParcial =
  | 'fatura-paga'
  | 'valor-invalido'
  | 'data-invalida'
  | 'excede-restante'
  | 'quita-a-fatura'

/**
 * A recusa leva o motivo, para quem decide em código, e a mensagem, para quem
 * mostra: o diálogo de registro e o erro do main usam o mesmo texto.
 */
export type RegistrarPagamentoParcialResult =
  | { ok: true }
  | { ok: false; motivo: MotivoRecusaPagamentoParcial; erro: string }

export type ExcluirPagamentoParcialResult =
  | { ok: true }
  | { ok: false; motivo: 'fatura-paga'; erro: string }

const DATA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function ehDataDeCalendario(data: string): boolean {
  const match = DATA_REGEX.exec(data)
  if (!match) return false
  const ano = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])
  if (mes < 1 || mes > 12) return false
  return dia >= 1 && dia <= diasNoMes(ano, mes)
}

/**
 * RN-10 — quem aceita pagamento parcial.
 *
 * Fatura Aberta e Fechada aceitam. Paga é imutável (RF-FAT-04): quem quer
 * registrar algo nela reabre antes (RF-FAT-05).
 *
 * A fatura é checada antes do valor de propósito, como em
 * `podeMarcarOcorrenciaPaga`: quando os dois valem, a mensagem precisa apontar
 * o dono da decisão, não o sintoma.
 *
 * O teto é o que falta pagar. Na fatura Fechada, o valor que quita o restante
 * também é recusado: aceitá-lo deixaria a fatura sem nada a pagar e sem estar
 * paga, com as parcelas pendentes. Quitar é "Marcar como paga", que grava a
 * data e marca as parcelas (RN-06). Na Aberta o mesmo valor é aceito — ela
 * ainda não pode ser marcada como paga, e novas compras podem entrar.
 */
export function podeRegistrarPagamentoParcial(
  p: PagamentoParaRegistrar
): RegistrarPagamentoParcialResult {
  if (p.statusFatura === 'Paga') {
    return {
      ok: false,
      motivo: 'fatura-paga',
      erro: 'Fatura já está paga. Reabra a fatura antes de registrar um pagamento parcial.'
    }
  }
  if (!Number.isInteger(p.valorCentavos) || p.valorCentavos < 1) {
    return {
      ok: false,
      motivo: 'valor-invalido',
      erro: 'O valor do pagamento deve ser maior que zero.'
    }
  }
  if (!ehDataDeCalendario(p.dataPagamento)) {
    return {
      ok: false,
      motivo: 'data-invalida',
      erro: `Data de pagamento inválida: '${p.dataPagamento}'. Esperado YYYY-MM-DD.`
    }
  }
  if (p.valorCentavos > p.restanteCentavos) {
    return {
      ok: false,
      motivo: 'excede-restante',
      erro: 'O valor passa do que falta pagar nesta fatura.'
    }
  }
  if (p.statusFatura === 'Fechada' && p.valorCentavos === p.restanteCentavos) {
    return {
      ok: false,
      motivo: 'quita-a-fatura',
      erro: 'Esse valor quita a fatura. Para registrar a quitação, use "Marcar como paga".'
    }
  }
  return { ok: true }
}

/**
 * RN-10 — excluir pagamento parcial.
 *
 * É a única correção desta versão: sem edição, errar o valor se resolve
 * excluindo e registrando de novo. Em fatura Paga a saída é a de sempre,
 * reabrir.
 */
export function podeExcluirPagamentoParcial(
  statusFatura: StatusFatura['kind']
): ExcluirPagamentoParcialResult {
  if (statusFatura === 'Paga') {
    return {
      ok: false,
      motivo: 'fatura-paga',
      erro: 'Fatura já está paga. Reabra a fatura antes de excluir um pagamento parcial.'
    }
  }
  return { ok: true }
}
