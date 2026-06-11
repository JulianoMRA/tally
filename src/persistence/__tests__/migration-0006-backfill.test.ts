import { describe, it, expect } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { loadBundledMigrations, runMigrations } from '../migrations/runner'

/**
 * Migration 0006 — backfill de parcelas em faturas já Pagas.
 * Bancos criados antes da sincronização parcela <-> fatura (PR integridade)
 * têm faturas Paga com parcelas ainda Pendente; a migration alinha o estado.
 */
describe('0006_backfill_parcelas_pagas', () => {
  function aplicarAte0005(db: Database): void {
    const anteriores = loadBundledMigrations().filter((m) => m.version < '0006')
    runMigrations(db, anteriores)
  }

  function seed(db: Database): { parcelaPagaId: number; parcelaAbertaId: number } {
    const cartaoId = Number(
      db
        .prepare(
          "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 5, 12, '#000')"
        )
        .run().lastInsertRowid
    )
    const catId = Number(
      db
        .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Mercado', 'Despesa', '#aaa')")
        .run().lastInsertRowid
    )
    const despesaId = Number(
      db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
           VALUES ('TV', ?, 'Parcelada', 'Credito', ?, 2000, 2, '2026-05-03')`
        )
        .run(catId, cartaoId).lastInsertRowid
    )

    const faturaPagaId = Number(
      db
        .prepare(
          `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento)
           VALUES (?, '2026-05', '2026-05-05', '2026-05-12', 'Paga', '2026-05-12')`
        )
        .run(cartaoId).lastInsertRowid
    )
    const faturaAbertaId = Number(
      db
        .prepare(
          `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
           VALUES (?, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')`
        )
        .run(cartaoId).lastInsertRowid
    )

    const parcelaPagaId = Number(
      db
        .prepare(
          `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
           VALUES (?, ?, 1, 2, 1000, '2026-05-01')`
        )
        .run(despesaId, faturaPagaId).lastInsertRowid
    )
    const parcelaAbertaId = Number(
      db
        .prepare(
          `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
           VALUES (?, ?, 2, 2, 1000, '2026-06-01')`
        )
        .run(despesaId, faturaAbertaId).lastInsertRowid
    )

    return { parcelaPagaId, parcelaAbertaId }
  }

  it('marca como Paga (com a data da fatura) as parcelas Pendente de faturas Paga', () => {
    const db = openInMemoryDatabase()
    aplicarAte0005(db)
    const { parcelaPagaId } = seed(db)

    runMigrations(db)

    const row = db
      .prepare('SELECT status, data_pagamento FROM parcela WHERE id = ?')
      .get(parcelaPagaId) as { status: string; data_pagamento: string | null }
    expect(row.status).toBe('Paga')
    expect(row.data_pagamento).toBe('2026-05-12')
    db.close()
  })

  it('não toca parcelas de faturas Aberta', () => {
    const db = openInMemoryDatabase()
    aplicarAte0005(db)
    const { parcelaAbertaId } = seed(db)

    runMigrations(db)

    const row = db
      .prepare('SELECT status, data_pagamento FROM parcela WHERE id = ?')
      .get(parcelaAbertaId) as { status: string; data_pagamento: string | null }
    expect(row.status).toBe('Pendente')
    expect(row.data_pagamento).toBeNull()
    db.close()
  })

  it('é idempotente em banco novo (sem dados, aplica sem erro)', () => {
    const db = openInMemoryDatabase()
    const result = runMigrations(db)
    expect(result.applied).toContain('0006_backfill_parcelas_pagas')
    db.close()
  })
})
