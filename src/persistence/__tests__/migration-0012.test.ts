import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Backfill de reparo: valida que a 0012 realinha ao mês da fatura as parcelas
 * que o adiantamento deixou divergentes, sem encostar nas que já estavam
 * certas nem nas de gasto fora do cartão, que não têm fatura.
 *
 * A 0010 fez esse mesmo backfill uma vez; o `adiantar` o desfazia a cada uso.
 * Com o código corrigido, esta migration é a que fecha a conta nos bancos que
 * já rodaram com o bug.
 */
describe('migration 0012_realinha_data_referencia_apos_adiantamento', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(
      db,
      loadBundledMigrations().filter((m) => m.version < '0012')
    )
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#000')
    db.prepare(
      "INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Casa', 'Despesa', '#aaa')"
    ).run()
  })

  function aplicar0012(): void {
    runMigrations(db, loadBundledMigrations())
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
       VALUES (?, 'Compra', 1, 'Parcelada', ?, ?, 10000, 3, '2026-01-10')`
    ).run(id, cartaoId === null ? 'Pix' : 'Credito', cartaoId)
  }

  // `numero` é parâmetro por causa do UNIQUE (despesa_id, numero) do schema.
  function inserirParcela(
    id: number,
    despesaId: number,
    faturaId: number | null,
    dataReferencia: string,
    numero = 1
  ): void {
    db.prepare(
      `INSERT INTO parcela (id, despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (?, ?, ?, ?, 3, 10000, ?)`
    ).run(id, despesaId, faturaId, numero, dataReferencia)
  }

  function dataReferenciaDe(id: number): string {
    return (
      db.prepare('SELECT data_referencia FROM parcela WHERE id = ?').get(id) as {
        data_referencia: string
      }
    ).data_referencia
  }

  it('realinha a parcela que o adiantamento moveu sem mexer na data', () => {
    inserirFatura(1, '2026-02')
    inserirFatura(2, '2026-06')
    inserirDespesa(1, 1)
    // Estado que o bug produzia: fatura_id já no destino, data_referencia no
    // mês de origem.
    inserirParcela(10, 1, 1, '2026-06-01')

    aplicar0012()

    expect(dataReferenciaDe(10)).toBe('2026-02-01')
  })

  it('não encosta na parcela que já respeita o invariante', () => {
    inserirFatura(1, '2026-02')
    inserirDespesa(1, 1)
    inserirParcela(10, 1, 1, '2026-02-01')

    const antes = (
      db.prepare('SELECT updated_at FROM parcela WHERE id = 10').get() as { updated_at: string }
    ).updated_at

    aplicar0012()

    expect(dataReferenciaDe(10)).toBe('2026-02-01')
    const depois = (
      db.prepare('SELECT updated_at FROM parcela WHERE id = 10').get() as { updated_at: string }
    ).updated_at
    expect(depois).toBe(antes)
  })

  it('preserva a data da compra do gasto fora do cartão, que não tem fatura', () => {
    inserirDespesa(2, null)
    inserirParcela(20, 2, null, '2026-06-28')

    aplicar0012()

    expect(dataReferenciaDe(20)).toBe('2026-06-28')
  })

  it('não deixa nenhuma parcela com fatura divergente', () => {
    inserirFatura(1, '2026-02')
    inserirFatura(2, '2026-06')
    inserirFatura(3, '2026-07')
    inserirDespesa(1, 1)
    inserirParcela(10, 1, 1, '2026-06-01', 1)
    inserirParcela(11, 1, 1, '2026-07-01', 2)
    inserirParcela(12, 1, 2, '2026-06-01', 3)

    aplicar0012()

    const divergentes = db
      .prepare(
        `SELECT p.id FROM parcela p
         INNER JOIN fatura f ON f.id = p.fatura_id
         WHERE p.data_referencia <> f.mes_referencia || '-01'`
      )
      .all() as { id: number }[]
    expect(divergentes).toEqual([])
  })
})
