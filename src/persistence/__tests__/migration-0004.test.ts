import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Slice 15 — valida que a migration 0004 normaliza data_referencia
 * de YYYY-MM para YYYY-MM-DD com dia 01 em registros existentes.
 */
describe('migration 0004_normaliza_data_referencia', () => {
  it('sufixa "-01" em parcela.data_referencia com length 7 (formato antigo)', () => {
    const db = openInMemoryDatabase()

    // Aplica ate 0003 (antes da normalizacao)
    const todas = loadBundledMigrations()
    const ate0003 = todas.filter((m) => m.version <= '0003_drop_colunas_mortas')
    runMigrations(db, ate0003)

    db.prepare(
      'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
    ).run('Inter', 5, 12, '#000')
    db.prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Lazer', 'Despesa', '#fa0')").run()
    db.prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
       VALUES ('Curso', 1, 'Parcelada', 'Credito', 1, 30000, 3, '2026-05-01')`
    ).run()
    db.prepare(
      "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (1, '2026-05', '2026-05-05', '2026-05-12', 'Aberta')"
    ).run()

    // Insere parcela no formato antigo (YYYY-MM)
    db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (1, 1, 1, 3, 10000, '2026-05')`
    ).run()

    // Insere parcela no formato novo (YYYY-MM-DD) — nao deve ser tocada
    db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (1, 1, 2, 3, 10000, '2026-06-15')`
    ).run()

    // Aplica 0004
    runMigrations(db, todas)

    const rows = db
      .prepare('SELECT numero, data_referencia FROM parcela ORDER BY numero')
      .all() as { numero: number; data_referencia: string }[]
    expect(rows).toEqual([
      { numero: 1, data_referencia: '2026-05-01' },
      { numero: 2, data_referencia: '2026-06-15' }
    ])
  })

  it('e idempotente: rodar 0004 duas vezes nao tem efeito extra', () => {
    const db = openInMemoryDatabase()
    runMigrations(db)
    const second = runMigrations(db)
    expect(second.applied).toEqual([])
    expect(second.skipped).toHaveLength(4)
  })
})
