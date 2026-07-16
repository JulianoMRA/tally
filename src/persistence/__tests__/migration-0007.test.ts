import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Fase 2 (hardening de dados) — valida que a 0007:
 *   * cria o indice unico ux_parcela_despesa_numero (defesa contra dupla
 *     geracao de ocorrencias/parcelas);
 *   * reconstroi `fatura` com CHECK correto de mes_referencia (o GLOB
 *     original `[0-1][0-9]` aceitava '2026-00' e '2026-13'..'2026-19');
 *   * preserva dados, ids e FKs no upgrade;
 *   * falha (sem dedup silencioso) quando ha duplicatas pre-existentes.
 */
describe('migration 0007_hardening_schema', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function aplicarAte0006(): void {
    const todas = loadBundledMigrations()
    const ate0006 = todas.filter((m) => m.version <= '0006_backfill_parcelas_pagas')
    runMigrations(db, ate0006)
  }

  function inserirBase(): void {
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#f60')
    db.prepare(
      "INSERT INTO categoria (id, nome, tipo, cor) VALUES (10, 'Mercado', 'Despesa', ?)"
    ).run('#fa0')
    db.prepare(
      `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
       VALUES (100, 'Compra', 10, 'Parcelada', 'Credito', 1, 6000, 2, '2026-05-01')`
    ).run()
  }

  it('cria o indice unico de parcela e recria o indice de fatura', () => {
    runMigrations(db)

    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
    const nomes = indices.map((i) => i.name)

    expect(nomes).toContain('ux_parcela_despesa_numero')
    expect(nomes).toContain('idx_fatura_cartao_mes')
  })

  it('CHECK novo rejeita meses invalidos e aceita 01..12', () => {
    runMigrations(db)
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#f60')

    const inserir = (mes: string) =>
      db
        .prepare(
          `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
           VALUES (1, ?, '2026-06-05', '2026-06-12', 'Aberta')`
        )
        .run(mes)

    expect(() => inserir('2026-00')).toThrow(/CHECK/i)
    expect(() => inserir('2026-13')).toThrow(/CHECK/i)
    expect(() => inserir('2026-19')).toThrow(/CHECK/i)
    expect(() => inserir('2026-01')).not.toThrow()
    expect(() => inserir('2026-12')).not.toThrow()
  })

  it('upgrade preserva dados, ids, FKs e reativa foreign_keys', () => {
    aplicarAte0006()
    inserirBase()
    db.prepare(
      `INSERT INTO fatura (id, cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento)
       VALUES (30, 1, '2026-05', '2026-05-05', '2026-05-12', 'Paga', '2026-05-12')`
    ).run()
    db.prepare(
      `INSERT INTO parcela (id, despesa_id, fatura_id, numero, total, valor_centavos, data_referencia, status, data_pagamento)
       VALUES (300, 100, 30, 1, 2, 3000, '2026-05-01', 'Paga', '2026-05-12')`
    ).run()

    runMigrations(db)

    const fatura = db.prepare('SELECT * FROM fatura WHERE id = 30').get() as {
      id: number
      mes_referencia: string
      status: string
      data_pagamento: string
    }
    expect(fatura).toMatchObject({
      id: 30,
      mes_referencia: '2026-05',
      status: 'Paga',
      data_pagamento: '2026-05-12'
    })

    const parcela = db.prepare('SELECT * FROM parcela WHERE id = 300').get() as {
      fatura_id: number
    }
    expect(parcela.fatura_id).toBe(30)

    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(fk.foreign_keys).toBe(1)
  })

  it('duplicata pre-existente de (despesa_id, numero) faz a migration falhar sem dedup', () => {
    aplicarAte0006()
    inserirBase()
    const inserirParcela = db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (100, NULL, 1, 2, 3000, '2026-05-01')`
    )
    inserirParcela.run()
    inserirParcela.run()

    expect(() => runMigrations(db)).toThrow(/UNIQUE/i)

    // Nenhuma linha foi apagada silenciosamente
    const n = db.prepare('SELECT COUNT(*) AS n FROM parcela').get() as { n: number }
    expect(n.n).toBe(2)
  })

  it('apos a migration, inserir parcela duplicada falha', () => {
    runMigrations(db)
    inserirBase()

    const inserirParcela = db.prepare(
      `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
       VALUES (100, NULL, 1, 2, 3000, '2026-05-01')`
    )
    inserirParcela.run()
    expect(() => inserirParcela.run()).toThrow(/UNIQUE/i)
  })

  it('fatura legada com mes_referencia invalido faz a migration falhar (nao migra lixo)', () => {
    aplicarAte0006()
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#f60')
    // '2026-19' passava no GLOB antigo ([0-1][0-9])
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (1, '2026-19', '2026-06-05', '2026-06-12', 'Aberta')`
    ).run()

    expect(() => runMigrations(db)).toThrow(/CHECK/i)
  })
})
