import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Fase 11 — a 0008 adiciona `despesa.nota` e as tabelas `tag` /
 * `despesa_tag` (N:N com CASCADE nos dois lados).
 */
describe('migration 0008_tags_notas', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function inserirDespesa(id: number): void {
    db.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#f60')`
    )
    db.exec(`INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Mercado', 'Despesa', '#fa0')`)
    db.prepare(
      `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
       VALUES (?, 'Compra', 1, 'Unica', 'Credito', 1, 5000, 1, '2026-06-03')`
    ).run(id)
  }

  it('cria coluna nota, tabelas tag e despesa_tag', () => {
    runMigrations(db)

    const colsDespesa = (db.prepare('PRAGMA table_info(despesa)').all() as { name: string }[]).map(
      (c) => c.name
    )
    expect(colsDespesa).toContain('nota')

    const tabelas = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    ).map((t) => t.name)
    expect(tabelas).toContain('tag')
    expect(tabelas).toContain('despesa_tag')
  })

  it('nome de tag é único case-insensitive', () => {
    runMigrations(db)
    db.prepare('INSERT INTO tag (nome) VALUES (?)').run('Viagem')
    expect(() => db.prepare('INSERT INTO tag (nome) VALUES (?)').run('viagem')).toThrow(/UNIQUE/i)
  })

  it('apagar a despesa remove os vínculos em despesa_tag (CASCADE)', () => {
    runMigrations(db)
    inserirDespesa(10)
    db.prepare('INSERT INTO tag (id, nome) VALUES (1, ?)').run('Viagem')
    db.prepare('INSERT INTO despesa_tag (despesa_id, tag_id) VALUES (10, 1)').run()

    // parcela nenhuma; apagar direto a despesa
    db.prepare('DELETE FROM despesa WHERE id = 10').run()

    const n = db.prepare('SELECT COUNT(*) AS n FROM despesa_tag').get() as { n: number }
    expect(n.n).toBe(0)
    // a tag em si permanece (compartilhável entre despesas)
    const t = db.prepare('SELECT COUNT(*) AS n FROM tag').get() as { n: number }
    expect(t.n).toBe(1)
  })

  it('apagar a tag remove os vínculos (CASCADE)', () => {
    runMigrations(db)
    inserirDespesa(10)
    db.prepare('INSERT INTO tag (id, nome) VALUES (1, ?)').run('Viagem')
    db.prepare('INSERT INTO despesa_tag (despesa_id, tag_id) VALUES (10, 1)').run()

    db.prepare('DELETE FROM tag WHERE id = 1').run()
    const n = db.prepare('SELECT COUNT(*) AS n FROM despesa_tag').get() as { n: number }
    expect(n.n).toBe(0)
  })

  it('preserva despesas existentes no upgrade (nota vem NULL)', () => {
    const todas = loadBundledMigrations()
    const ate0007 = todas.filter((m) => m.version <= '0007_hardening_schema')
    runMigrations(db, ate0007)
    inserirDespesa(10)

    runMigrations(db, todas)

    const row = db.prepare('SELECT nota FROM despesa WHERE id = 10').get() as {
      nota: string | null
    }
    expect(row.nota).toBeNull()
  })

  it('bundle idempotente inclui a 0008', () => {
    runMigrations(db)
    const files = loadBundledMigrations()
    expect(files.map((f) => f.version)).toContain('0008_tags_notas')
    const second = runMigrations(db, files)
    expect(second.applied).toEqual([])
    expect(second.skipped).toContain('0008_tags_notas')
  })
})
