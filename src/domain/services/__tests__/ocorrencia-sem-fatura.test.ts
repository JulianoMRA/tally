import { describe, expect, it } from 'vitest'
import {
  podeDesmarcarOcorrenciaPaga,
  podeMarcarOcorrenciaPaga,
  type OcorrenciaParaMarcar
} from '../ocorrencia-sem-fatura'

function ocorrencia(over: Partial<OcorrenciaParaMarcar> = {}): OcorrenciaParaMarcar {
  return { faturaId: null, status: 'Pendente', ...over }
}

/**
 * RF-DES-21 — quem marca uma ocorrência como paga.
 *
 * Com fatura, quem marca é o pagamento da fatura (RN-06): marcar a parcela
 * isolada furaria o ciclo de vida, deixando uma fatura Aberta com parcela Paga
 * dentro. Sem fatura não há esse dono, e até aqui não havia dono nenhum — o
 * aluguel no Pix nunca ficava pago enquanto a compra no crédito ficava.
 */
describe('podeMarcarOcorrenciaPaga', () => {
  it('aceita ocorrência pendente sem fatura', () => {
    expect(podeMarcarOcorrenciaPaga(ocorrencia())).toEqual({ ok: true })
  })

  it('recusa quando a ocorrência pertence a uma fatura', () => {
    expect(podeMarcarOcorrenciaPaga(ocorrencia({ faturaId: 7 }))).toEqual({
      ok: false,
      motivo: 'pertence-a-fatura'
    })
  })

  // A fatura manda mesmo quando o estado da parcela já seria recusado por si:
  // a mensagem precisa apontar o dono da decisão, não o sintoma.
  it('acusa a fatura antes de acusar o status, quando os dois valem', () => {
    expect(podeMarcarOcorrenciaPaga(ocorrencia({ faturaId: 7, status: 'Paga' }))).toEqual({
      ok: false,
      motivo: 'pertence-a-fatura'
    })
  })

  it('recusa ocorrência que já está paga', () => {
    expect(podeMarcarOcorrenciaPaga(ocorrencia({ status: 'Paga' }))).toEqual({
      ok: false,
      motivo: 'ja-paga'
    })
  })
})

/**
 * Desmarcar existe porque marcar tem consequência: parcela Paga bloqueia
 * excluir (RF-DES-09) e editar (RF-DES-10) a despesa inteira. Sem volta, pagar
 * o aluguel de setembro travaria a despesa "Aluguel" para sempre — não daria
 * nem para corrigir um erro de digitação. É a mesma escotilha que reabrir uma
 * fatura paga dá no lado do crédito (RF-FAT-05).
 */
describe('podeDesmarcarOcorrenciaPaga', () => {
  it('aceita ocorrência paga sem fatura', () => {
    expect(podeDesmarcarOcorrenciaPaga(ocorrencia({ status: 'Paga' }))).toEqual({ ok: true })
  })

  it('recusa quando a ocorrência pertence a uma fatura', () => {
    expect(podeDesmarcarOcorrenciaPaga(ocorrencia({ faturaId: 7, status: 'Paga' }))).toEqual({
      ok: false,
      motivo: 'pertence-a-fatura'
    })
  })

  it('recusa ocorrência que já está pendente', () => {
    expect(podeDesmarcarOcorrenciaPaga(ocorrencia())).toEqual({
      ok: false,
      motivo: 'ja-pendente'
    })
  })
})
