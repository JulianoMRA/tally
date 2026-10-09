import { describe, it, expect } from 'vitest'
import type { Fatura } from '@domain/entities/fatura'
import {
  avisoDePrazo,
  estaVencida,
  rotuloFechamento,
  rotuloVencida,
  rotuloVencimento
} from '../aviso-fechamento'

function fatura(overrides: Partial<Fatura> = {}): Fatura {
  return {
    id: 1,
    cartaoId: 1,
    mesReferencia: '2026-07',
    dataFechamento: '2026-07-20',
    dataVencimento: '2026-07-27',
    status: { kind: 'Aberta' },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides
  }
}

describe('rotuloFechamento', () => {
  it('retorna "fecha hoje" no dia do fechamento', () => {
    expect(rotuloFechamento(fatura(), '2026-07-20')).toBe('fecha hoje')
  })

  it('retorna "fecha amanhã" na véspera', () => {
    expect(rotuloFechamento(fatura(), '2026-07-19')).toBe('fecha amanhã')
  })

  it('retorna "fecha em N dias" dentro do limiar', () => {
    expect(rotuloFechamento(fatura(), '2026-07-16')).toBe('fecha em 4 dias')
    expect(rotuloFechamento(fatura(), '2026-07-13')).toBe('fecha em 7 dias')
  })

  it('retorna null fora do limiar ou com fechamento passado', () => {
    expect(rotuloFechamento(fatura(), '2026-07-12')).toBeNull()
    expect(rotuloFechamento(fatura(), '2026-07-21')).toBeNull()
  })

  it('retorna null para faturas Fechada ou Paga', () => {
    expect(rotuloFechamento(fatura({ status: { kind: 'Fechada' } }), '2026-07-19')).toBeNull()
    expect(
      rotuloFechamento(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-19' } }), '2026-07-19')
    ).toBeNull()
  })
})

// dataVencimento das fixtures = 2026-07-27
const fechada = (o: Partial<Fatura> = {}) => fatura({ status: { kind: 'Fechada' }, ...o })

describe('estaVencida', () => {
  it('é true para fatura Fechada com vencimento já passado', () => {
    expect(estaVencida(fechada(), '2026-07-28')).toBe(true)
    expect(estaVencida(fechada(), '2026-08-10')).toBe(true)
  })

  it('é false no próprio dia do vencimento (ainda não venceu)', () => {
    expect(estaVencida(fechada(), '2026-07-27')).toBe(false)
  })

  it('é false para fatura Fechada com vencimento futuro', () => {
    expect(estaVencida(fechada(), '2026-07-20')).toBe(false)
  })

  it('é false para fatura Paga, mesmo com vencimento passado', () => {
    expect(
      estaVencida(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-28' } }), '2026-07-30')
    ).toBe(false)
  })

  it('é false para fatura Aberta (ainda não é pagável), mesmo com vencimento passado', () => {
    expect(estaVencida(fatura({ status: { kind: 'Aberta' } }), '2026-07-30')).toBe(false)
  })
})

describe('rotuloVencida', () => {
  it('retorna "vencida há 1 dia" no primeiro dia após o vencimento', () => {
    expect(rotuloVencida(fechada(), '2026-07-28')).toBe('vencida há 1 dia')
  })

  it('pluraliza "vencida há N dias"', () => {
    expect(rotuloVencida(fechada(), '2026-07-30')).toBe('vencida há 3 dias')
  })

  it('retorna null quando não está vencida', () => {
    expect(rotuloVencida(fechada(), '2026-07-27')).toBeNull()
    expect(rotuloVencida(fechada(), '2026-07-20')).toBeNull()
    expect(
      rotuloVencida(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-28' } }), '2026-07-30')
    ).toBeNull()
  })
})

// RF-FAT-06 — a fatura Fechada perto do vencimento não avisava nada: o card
// dizia "vence 01/10" em cinza a dois dias do prazo, enquanto a notificação do
// sistema já dizia "vence em 2 dias". Mesma janela do "fecha em".
describe('rotuloVencimento', () => {
  it('retorna "vence hoje" no dia do vencimento', () => {
    expect(rotuloVencimento(fechada(), '2026-07-27')).toBe('vence hoje')
  })

  it('retorna "vence amanhã" na véspera', () => {
    expect(rotuloVencimento(fechada(), '2026-07-26')).toBe('vence amanhã')
  })

  it('retorna "vence em N dias" dentro do limiar', () => {
    expect(rotuloVencimento(fechada(), '2026-07-25')).toBe('vence em 2 dias')
    expect(rotuloVencimento(fechada(), '2026-07-20')).toBe('vence em 7 dias')
  })

  it('retorna null fora do limiar e depois do vencimento', () => {
    expect(rotuloVencimento(fechada(), '2026-07-19')).toBeNull()
    expect(rotuloVencimento(fechada(), '2026-07-28')).toBeNull()
  })

  it('retorna null para fatura Aberta ou Paga', () => {
    expect(rotuloVencimento(fatura(), '2026-07-26')).toBeNull()
    expect(
      rotuloVencimento(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-20' } }), '2026-07-26')
    ).toBeNull()
  })
})

// O aviso que a tela mostra ao lado do prazo, com o tom dele. Os três rótulos
// nunca valem juntos — "fecha em" é de Aberta, os outros dois de Fechada —, mas
// quem exibe não deveria precisar saber disso para compô-los.
describe('avisoDePrazo', () => {
  it('fatura vencida é alerta', () => {
    expect(avisoDePrazo(fechada(), '2026-07-30')).toEqual({
      texto: 'vencida há 3 dias',
      tom: 'alerta',
      data: '2026-07-27'
    })
  })

  it('vencimento próximo é atenção', () => {
    expect(avisoDePrazo(fechada(), '2026-07-25')).toEqual({
      texto: 'vence em 2 dias',
      tom: 'atencao',
      data: '2026-07-27'
    })
  })

  // A data é a do evento que o aviso nomeia: o fechamento, e não o vencimento.
  it('fechamento próximo é atenção', () => {
    expect(avisoDePrazo(fatura(), '2026-07-16')).toEqual({
      texto: 'fecha em 4 dias',
      tom: 'atencao',
      data: '2026-07-20'
    })
  })

  it('sem prazo perto, não há aviso', () => {
    expect(avisoDePrazo(fatura(), '2026-07-01')).toBeNull()
    expect(avisoDePrazo(fechada(), '2026-07-10')).toBeNull()
  })

  it('fatura paga nunca tem aviso', () => {
    expect(
      avisoDePrazo(fatura({ status: { kind: 'Paga', pagaEm: '2026-07-20' } }), '2026-07-30')
    ).toBeNull()
  })
})

/**
 * RN-10 — fatura Fechada cujos pagamentos parciais já cobrem o total. Não há o
 * que pagar, só o que marcar: "vence em 2 dias" e "vencida há 3 dias" seriam
 * alarme falso, em vermelho, sobre uma fatura quitada.
 */
describe('prazo de fatura sem nada a pagar', () => {
  const NADA_A_PAGAR = true

  it('não avisa o vencimento que está chegando', () => {
    expect(avisoDePrazo(fechada(), '2026-07-25', NADA_A_PAGAR)).toBeNull()
  })

  it('não diz que está vencida', () => {
    expect(avisoDePrazo(fechada(), '2026-07-30', NADA_A_PAGAR)).toBeNull()
    expect(rotuloVencida(fechada(), '2026-07-30', NADA_A_PAGAR)).toBeNull()
  })

  // Fechar continua sendo um evento: depois dele a fatura não recebe mais
  // adiantamento nem edição (RN-06), com ou sem valor a pagar.
  it('fatura Aberta segue avisando o fechamento', () => {
    expect(avisoDePrazo(fatura(), '2026-07-16', NADA_A_PAGAR)).toEqual({
      texto: 'fecha em 4 dias',
      tom: 'atencao',
      data: '2026-07-20'
    })
  })

  it('com valor a pagar, os avisos seguem como sempre', () => {
    expect(avisoDePrazo(fechada(), '2026-07-30', false)).toEqual({
      texto: 'vencida há 3 dias',
      tom: 'alerta',
      data: '2026-07-27'
    })
    expect(rotuloVencida(fechada(), '2026-07-30', false)).toBe('vencida há 3 dias')
  })
})
