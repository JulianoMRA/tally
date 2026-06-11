import { describe, expect, it } from 'vitest'
import type { Parcela } from '../../entities/parcela'
import {
  parcelasElegiveisParaRecalculo,
  podeDeletarDespesa,
  podeEditarDespesa,
  type ParcelaComStatusFatura,
  type StatusFaturaDaParcela
} from '../regras-despesa'

function parcela(numero: number, status: 'Pendente' | 'Paga'): Parcela {
  return {
    id: numero,
    despesaId: 1,
    faturaId: 100 + numero,
    numero,
    total: 12,
    valorCentavos: 1000,
    dataReferencia: '2026-06-01',
    status,
    dataPagamento: status === 'Paga' ? '2026-06-12' : null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z'
  }
}

function item(
  numero: number,
  status: 'Pendente' | 'Paga',
  statusFatura: StatusFaturaDaParcela = 'Aberta'
): ParcelaComStatusFatura {
  return { parcela: parcela(numero, status), statusFatura }
}

describe('podeDeletarDespesa (RF-DES-09)', () => {
  it('permite deletar quando não há parcelas', () => {
    expect(podeDeletarDespesa([])).toEqual({ ok: true })
  })

  it('permite deletar quando todas as parcelas estão Pendente em fatura Aberta', () => {
    expect(
      podeDeletarDespesa([item(1, 'Pendente'), item(2, 'Pendente'), item(3, 'Pendente')])
    ).toEqual({ ok: true })
  })

  it('permite deletar parcela Pendente sem fatura (gasto fora de cartão)', () => {
    expect(podeDeletarDespesa([item(1, 'Pendente', null)])).toEqual({ ok: true })
  })

  it('bloqueia quando ha pelo menos uma parcela Paga', () => {
    const r = podeDeletarDespesa([item(1, 'Pendente'), item(2, 'Paga'), item(3, 'Pendente')])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('has-parcela-paga')
      if (r.motivo === 'has-parcela-paga') expect(r.parcelasPagas).toEqual([2])
    }
  })

  it('reporta todas as parcelas pagas no motivo', () => {
    const r = podeDeletarDespesa([
      item(1, 'Paga'),
      item(2, 'Paga'),
      item(3, 'Pendente'),
      item(4, 'Paga')
    ])
    expect(r.ok).toBe(false)
    if (!r.ok && r.motivo === 'has-parcela-paga') expect(r.parcelasPagas).toEqual([1, 2, 4])
  })

  it('bloqueia quando ha parcela Pendente em fatura Fechada', () => {
    const r = podeDeletarDespesa([item(1, 'Pendente', 'Fechada'), item(2, 'Pendente')])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('has-parcela-em-fatura-fechada')
      if (r.motivo === 'has-parcela-em-fatura-fechada') expect(r.parcelasBloqueadas).toEqual([1])
    }
  })

  it('bloqueia quando ha parcela Pendente em fatura Paga (defensivo)', () => {
    const r = podeDeletarDespesa([item(1, 'Pendente', 'Paga')])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('has-parcela-em-fatura-fechada')
  })

  it('parcela Paga tem precedência sobre fatura Fechada no motivo', () => {
    const r = podeDeletarDespesa([item(1, 'Paga', 'Paga'), item(2, 'Pendente', 'Fechada')])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('has-parcela-paga')
  })
})

describe('podeEditarDespesa (RF-DES-10)', () => {
  it('permite editar quando nao ha parcelas', () => {
    expect(podeEditarDespesa([])).toEqual({ ok: true })
  })

  it('permite editar quando todas pendentes em fatura Aberta', () => {
    expect(podeEditarDespesa([item(1, 'Pendente'), item(2, 'Pendente')])).toEqual({ ok: true })
  })

  it('permite editar com parcela em fatura Fechada (redistribuicao trata a elegibilidade)', () => {
    expect(podeEditarDespesa([item(1, 'Pendente', 'Fechada'), item(2, 'Pendente')])).toEqual({
      ok: true
    })
  })

  it('bloqueia quando ha parcela Paga', () => {
    const r = podeEditarDespesa([item(1, 'Paga'), item(2, 'Pendente')])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('has-parcela-paga')
      expect(r.parcelasPagas).toEqual([1])
    }
  })
})

describe('parcelasElegiveisParaRecalculo (RF-DES-10)', () => {
  it('inclui parcelas Pendente em fatura Aberta', () => {
    const elegiveis = parcelasElegiveisParaRecalculo([item(1, 'Pendente'), item(2, 'Pendente')])
    expect(elegiveis).toEqual(new Set([1, 2]))
  })

  it('inclui parcelas Pendente sem fatura (fora de cartão)', () => {
    const elegiveis = parcelasElegiveisParaRecalculo([item(1, 'Pendente', null)])
    expect(elegiveis).toEqual(new Set([1]))
  })

  it('exclui parcelas em fatura Fechada ou Paga', () => {
    const elegiveis = parcelasElegiveisParaRecalculo([
      item(1, 'Pendente', 'Fechada'),
      item(2, 'Pendente', 'Paga'),
      item(3, 'Pendente', 'Aberta')
    ])
    expect(elegiveis).toEqual(new Set([3]))
  })

  it('exclui parcelas Paga mesmo em fatura Aberta', () => {
    const elegiveis = parcelasElegiveisParaRecalculo([item(1, 'Paga'), item(2, 'Pendente')])
    expect(elegiveis).toEqual(new Set([2]))
  })

  it('retorna vazio quando nada e elegivel', () => {
    const elegiveis = parcelasElegiveisParaRecalculo([item(1, 'Pendente', 'Fechada')])
    expect(elegiveis.size).toBe(0)
  })
})
