import { describe, it, expect } from 'vitest'
import type { Fatura, StatusFatura } from '@domain/entities/fatura'
import { datasDaLinha } from '../datas-da-linha'

function fatura(status: StatusFatura, dataFechamento: string, dataVencimento: string): Fatura {
  return {
    id: 1,
    cartaoId: 1,
    mesReferencia: dataFechamento.slice(0, 7),
    dataFechamento,
    dataVencimento,
    status,
    createdAt: '',
    updatedAt: ''
  }
}

const HOJE = '2026-09-29'

/**
 * A linha do histórico dizia "Fecha 25/06/2026 · Vence 05/07/2026" para datas
 * que já passaram, e misturava caixa com o aviso ao lado ("Vence … · vencida
 * há 88 dias"). O tempo do verbo vem do calendário, e a caixa é a do trilho.
 */
describe('datasDaLinha', () => {
  it('fatura paga diz quando fechou e quando foi paga', () => {
    expect(
      datasDaLinha(fatura({ kind: 'Paga', pagaEm: '2026-08-05' }, '2026-07-25', '2026-08-05'), HOJE)
    ).toBe('fechou 25/07/2026 · paga em 05/08/2026')
  })

  it('fatura não paga com vencimento passado diz que venceu', () => {
    expect(datasDaLinha(fatura({ kind: 'Fechada' }, '2026-06-25', '2026-07-05'), HOJE)).toBe(
      'fechou 25/06/2026 · venceu 05/07/2026'
    )
  })

  it('com o vencimento por vir, o verbo fica no presente', () => {
    expect(datasDaLinha(fatura({ kind: 'Fechada' }, '2026-09-25', '2026-10-05'), HOJE)).toBe(
      'fechou 25/09/2026 · vence 05/10/2026'
    )
  })

  // O próprio dia do vencimento ainda não é atraso: ainda dá tempo de pagar.
  it('no dia do vencimento ainda vence, não venceu', () => {
    expect(datasDaLinha(fatura({ kind: 'Fechada' }, '2026-09-20', '2026-09-29'), HOJE)).toBe(
      'fechou 20/09/2026 · vence 29/09/2026'
    )
  })

  // A fatura fecha no início do dia de fechamento (RN-06): nesse dia ela já
  // fechou. Antes dele — o que no histórico não acontece, mas a função não
  // depende disso — ainda fecha.
  it('o fechamento também segue o calendário', () => {
    expect(datasDaLinha(fatura({ kind: 'Fechada' }, '2026-09-29', '2026-10-06'), HOJE)).toBe(
      'fechou 29/09/2026 · vence 06/10/2026'
    )
    expect(datasDaLinha(fatura({ kind: 'Aberta' }, '2026-10-25', '2026-11-05'), HOJE)).toBe(
      'fecha 25/10/2026 · vence 05/11/2026'
    )
  })
})
