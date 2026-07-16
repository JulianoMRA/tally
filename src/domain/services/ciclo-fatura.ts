import type { Fatura, StatusFatura } from '../entities/fatura'

export type ResultadoTransicao =
  | { ok: true; novoStatus: StatusFatura }
  | { ok: false; erro: string }

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string }

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * RF-FAT-04 — fatura Paga é imutável: não aceita novas parcelas (reabra
 * antes, se for intencional). Fechada aceita, para permitir cadastro
 * retroativo na migração de dados da planilha.
 */
export function validarFaturaAceitaNovaParcela(fatura: Fatura): ResultadoValidacao {
  if (fatura.status.kind === 'Paga') {
    return {
      ok: false,
      erro: `Fatura ${fatura.mesReferencia} já está paga e não aceita novas parcelas. Reabra a fatura antes, se o lançamento for intencional.`
    }
  }
  return { ok: true }
}

export function precisaAutoFechar(fatura: Fatura, hoje: string): boolean {
  if (fatura.status.kind !== 'Aberta') return false
  return fatura.dataFechamento <= hoje
}

export function fecharFatura(fatura: Fatura): ResultadoTransicao {
  if (fatura.status.kind === 'Fechada') {
    return { ok: false, erro: 'Fatura já está fechada.' }
  }
  if (fatura.status.kind === 'Paga') {
    return { ok: false, erro: 'Fatura paga não pode ser fechada.' }
  }
  return { ok: true, novoStatus: { kind: 'Fechada' } }
}

export function pagarFatura(fatura: Fatura, dataPagamento: string): ResultadoTransicao {
  if (!DATA_REGEX.test(dataPagamento)) {
    return {
      ok: false,
      erro: `Data de pagamento inválida: '${dataPagamento}'. Esperado YYYY-MM-DD.`
    }
  }
  if (fatura.status.kind === 'Aberta') {
    return { ok: false, erro: 'Fatura deve ser fechada antes de ser marcada como paga.' }
  }
  if (fatura.status.kind === 'Paga') {
    return { ok: false, erro: 'Fatura já está paga.' }
  }
  return { ok: true, novoStatus: { kind: 'Paga', pagaEm: dataPagamento } }
}

/**
 * RF-FAT-05 — reabrir desfaz o pagamento, mas respeita RN-06: se a data de
 * fechamento já passou, a fatura reabre como Fechada (não volta a aceitar
 * parcelas novas); caso contrário volta a Aberta.
 */
export function reabrirFatura(fatura: Fatura, hoje: string): ResultadoTransicao {
  if (!DATA_REGEX.test(hoje)) {
    return { ok: false, erro: `Data inválida: '${hoje}'. Esperado YYYY-MM-DD.` }
  }
  if (fatura.status.kind !== 'Paga') {
    return { ok: false, erro: 'Apenas faturas pagas podem ser reabertas.' }
  }
  if (fatura.dataFechamento <= hoje) {
    return { ok: true, novoStatus: { kind: 'Fechada' } }
  }
  return { ok: true, novoStatus: { kind: 'Aberta' } }
}
