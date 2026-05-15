import type { Fatura, StatusFatura } from '../entities/fatura'

export type ResultadoTransicao =
  | { ok: true; novoStatus: StatusFatura }
  | { ok: false; erro: string }

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

export function reabrirFatura(fatura: Fatura): ResultadoTransicao {
  if (fatura.status.kind !== 'Paga') {
    return { ok: false, erro: 'Apenas faturas pagas podem ser reabertas.' }
  }
  return { ok: true, novoStatus: { kind: 'Aberta' } }
}
