import { describe, it, expect } from 'vitest'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Bloco D — valida que a migration 0005 cria a tabela orcamento e que a unicidade
 * do limite global por categoria é garantida pelo índice parcial ux_orcamento_global.
 */
describe('migration 0005_orcamento', () => {
  function aplicarAte0004(db = openInMemoryDatabase()) {
    const todas = loadBundledMigrations()
    const ate0004 = todas.filter((m) => m.version <= '0004_normaliza_data_referencia')
    runMigrations(db, ate0004)
    return db
  }

  it('tabela orcamento nao existe antes da 0005', () => {
    const db = aplicarAte0004()
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamento'")
      .get()
    expect(row).toBeUndefined()
  })

  it('cria a tabela orcamento com as colunas esperadas', () => {
    const db = openInMemoryDatabase()
    runMigrations(db)
    const cols = (db.prepare('PRAGMA table_info(orcamento)').all() as { name: string }[]).map(
      (c) => c.name
    )
    expect(cols).toEqual([
      'id',
      'categoria_id',
      'mes_referencia',
      'valor_limite_centavos',
      'created_at',
      'updated_at'
    ])
  })

  it('garante um unico limite global por categoria (ux_orcamento_global)', () => {
    const db = openInMemoryDatabase()
    runMigrations(db)
    db.prepare(
      "INSERT INTO categoria (nome, tipo, cor) VALUES ('Mercado', 'Despesa', '#4caf50')"
    ).run()

    db.prepare(
      'INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos) VALUES (1, NULL, 50000)'
    ).run()

    expect(() =>
      db
        .prepare(
          'INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos) VALUES (1, NULL, 60000)'
        )
        .run()
    ).toThrow()
  })

  it('rejeita valor de limite negativo (CHECK)', () => {
    const db = openInMemoryDatabase()
    runMigrations(db)
    db.prepare(
      "INSERT INTO categoria (nome, tipo, cor) VALUES ('Lazer', 'Despesa', '#2196f3')"
    ).run()
    expect(() =>
      db
        .prepare(
          'INSERT INTO orcamento (categoria_id, mes_referencia, valor_limite_centavos) VALUES (1, NULL, -1)'
        )
        .run()
    ).toThrow()
  })
})
