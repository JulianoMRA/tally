import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Backfill de `parcela.data_referencia`: valida que a 0010 realinha ao mês da
 * fatura as parcelas que guardavam a data da compra, sem encostar nas que já
 * estavam certas nem nas de gasto fora do cartão, que não têm fatura.
 */
describe('migration 0010_data_referencia_segue_a_fatura', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    const todas = loadBundledMigrations()
    runMigrations(
      db,
      todas.filter((m) => m.version < '0010')
    )
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#000')
    db.prepare(
      "INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Casa', 'Despesa', '#aaa')"
    ).run()
  })

  function aplicar0010(): void {
    runMigrations(db)
  }

  function inserirFatura(id: number, mesReferencia: string): void {
    db.prepare(
      `INSERT INTO fatura (id, cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, 1, ?, ?, ?, 'Aberta')`
    ).run(id, mesReferencia, `${mesReferencia}-05`, `${mesReferencia}-12`)
  }

  function inserirDespesa(id: number, cartaoId: number | null): void {
    db.prepare(
      `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
       VALUES (?, 'Compra', 1, 'Unica', ?, ?, 10000, 1, '2026-06-28')`
    ).run(id, cartaoId === null ? 'Pix' : 'Credito', cartaoId)
  }

  function inserirParcela(
    id: number,
    despesaId: number,
    faturaId: number | null,
    ref: string
  ): void {
    db.prepare(
      `INSERT INTO parcela (id, despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (?, ?, ?, 1, 1, 10000, ?)`
    ).run(id, despesaId, faturaId, ref)
  }

  function refDe(parcelaId: number): string {
    return (
      db.prepare('SELECT data_referencia AS r FROM parcela WHERE id = ?').get(parcelaId) as {
        r: string
      }
    ).r
  }

  // O caso que motivou a migration: compra em 28/06 num cartão que fecha dia 5
  // pertence à fatura de julho pelo RN-01, mas a parcela guardava junho.
  it('realinha a parcela que guardava a data da compra', () => {
    inserirFatura(1, '2026-07')
    inserirDespesa(1, 1)
    inserirParcela(1, 1, 1, '2026-06-28')

    aplicar0010()

    expect(refDe(1)).toBe('2026-07-01')
  })

  it('não encosta na parcela que já estava alinhada', () => {
    inserirFatura(1, '2026-07')
    inserirDespesa(1, 1)
    inserirParcela(1, 1, 1, '2026-07-01')
    const antes = (
      db.prepare('SELECT updated_at AS u FROM parcela WHERE id = 1').get() as { u: string }
    ).u

    aplicar0010()

    expect(refDe(1)).toBe('2026-07-01')
    expect(
      (db.prepare('SELECT updated_at AS u FROM parcela WHERE id = 1').get() as { u: string }).u
    ).toBe(antes)
  })

  // Fora do cartão não tem fatura: data_referencia é a única referência de mês
  // que a parcela possui, e os relatórios agrupam por ela.
  it('preserva a data da parcela sem fatura', () => {
    inserirDespesa(1, null)
    inserirParcela(1, 1, null, '2026-06-28')

    aplicar0010()

    expect(refDe(1)).toBe('2026-06-28')
  })

  it('realinha várias parcelas de faturas diferentes numa passada', () => {
    inserirFatura(1, '2026-07')
    inserirFatura(2, '2026-08')
    inserirDespesa(1, 1)
    inserirDespesa(2, 1)
    inserirParcela(1, 1, 1, '2026-06-28')
    inserirParcela(2, 2, 2, '2026-07-30')

    aplicar0010()

    expect(refDe(1)).toBe('2026-07-01')
    expect(refDe(2)).toBe('2026-08-01')
  })

  it('é idempotente — rodar de novo não muda nada', () => {
    inserirFatura(1, '2026-07')
    inserirDespesa(1, 1)
    inserirParcela(1, 1, 1, '2026-06-28')

    aplicar0010()
    const depois = refDe(1)
    runMigrations(db)

    expect(refDe(1)).toBe(depois)
  })

  it('base vazia não quebra', () => {
    expect(() => aplicar0010()).not.toThrow()
  })
})
