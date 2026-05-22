import { describe, expect, it } from 'vitest'
import type { Parcela } from '../../entities/parcela'
import { podeDeletarDespesa, podeEditarDespesa } from '../regras-despesa'

function parcela(numero: number, status: 'Pendente' | 'Paga'): Parcela {
  return {
    id: numero,
    despesaId: 1,
    faturaId: 100 + numero,
    numero,
    total: 12,
    valorCentavos: 1000,
    dataReferencia: '2026-06',
    status,
    dataPagamento: status === 'Paga' ? '2026-06-12' : null,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z'
  }
}

describe('podeDeletarDespesa (RF-DES-09)', () => {
  it('permite deletar quando não há parcelas', () => {
    expect(podeDeletarDespesa([])).toEqual({ ok: true })
  })

  it('permite deletar quando todas as parcelas estão Pendente', () => {
    expect(
      podeDeletarDespesa([parcela(1, 'Pendente'), parcela(2, 'Pendente'), parcela(3, 'Pendente')])
    ).toEqual({ ok: true })
  })

  it('bloqueia quando ha pelo menos uma parcela Paga', () => {
    const r = podeDeletarDespesa([
      parcela(1, 'Pendente'),
      parcela(2, 'Paga'),
      parcela(3, 'Pendente')
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('has-parcela-paga')
      expect(r.parcelasPagas).toEqual([2])
    }
  })

  it('reporta todas as parcelas pagas no motivo', () => {
    const r = podeDeletarDespesa([
      parcela(1, 'Paga'),
      parcela(2, 'Paga'),
      parcela(3, 'Pendente'),
      parcela(4, 'Paga')
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.parcelasPagas).toEqual([1, 2, 4])
  })

  it('bloqueia quando ha uma unica parcela Paga', () => {
    const r = podeDeletarDespesa([parcela(7, 'Paga')])
    expect(r.ok).toBe(false)
  })
})

describe('podeEditarDespesa (RF-DES-10)', () => {
  it('permite editar quando nao ha parcelas', () => {
    expect(podeEditarDespesa([])).toEqual({ ok: true })
  })

  it('permite editar quando todas pendentes', () => {
    expect(podeEditarDespesa([parcela(1, 'Pendente'), parcela(2, 'Pendente')])).toEqual({
      ok: true
    })
  })

  it('bloqueia quando ha parcela Paga', () => {
    const r = podeEditarDespesa([parcela(1, 'Paga'), parcela(2, 'Pendente')])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('has-parcela-paga')
      expect(r.parcelasPagas).toEqual([1])
    }
  })
})
