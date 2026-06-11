import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Slice 15 — valida que a migration 0003 preserva dados ao dropar
 * colunas mortas via recreate-table com `@no-transaction` +
 * `PRAGMA foreign_keys = OFF`.
 *
 * Bug capturado em runtime real (Slice 15 dev): primeira versao usava
 * `PRAGMA defer_foreign_keys = ON` dentro da transacao do runner. Em
 * banco vazio funcionava; com dados reais (despesa→categoria e
 * recebimento→renda preenchidos) falhava com "database is locked"
 * porque `defer_foreign_keys` so adia checagem de violacoes, nao
 * permite DROP de tabela referenciada por FK ativa. Solucao definitiva:
 * `foreign_keys = OFF` (so funciona fora de transacao) via diretiva
 * `-- @no-transaction` no header da migration.
 */
describe('migration 0003_drop_colunas_mortas', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  it('preserva linhas de categoria e renda quando aplicada do zero', () => {
    runMigrations(db)

    // Insere antes de... (na verdade tudo no setup ja aplicou 0003,
    // entao validamos via insert + select no schema final)
    db.prepare('INSERT INTO categoria (id, nome, tipo, cor, ativo) VALUES (?, ?, ?, ?, 1)').run(
      10,
      'Mercado',
      'Despesa',
      '#fa0'
    )

    db.prepare(
      `INSERT INTO renda (id, nome, tipo, valor_padrao_centavos, dia_esperado)
       VALUES (?, ?, 'Recorrente', ?, ?)`
    ).run(20, 'Bolsa', 120000, 5)

    const cat = db.prepare('SELECT * FROM categoria WHERE id = 10').get() as {
      id: number
      nome: string
    }
    expect(cat).toMatchObject({ id: 10, nome: 'Mercado' })

    const renda = db.prepare('SELECT * FROM renda WHERE id = 20').get() as {
      id: number
      dia_esperado: number
    }
    expect(renda).toMatchObject({ id: 20, dia_esperado: 5 })
  })

  it('preserva FK recebimento.renda_id apos o recreate-table de renda', () => {
    runMigrations(db)

    db.prepare(
      `INSERT INTO renda (id, nome, tipo, valor_padrao_centavos, dia_esperado)
       VALUES (?, ?, 'Recorrente', ?, ?)`
    ).run(1, 'Salario', 500000, 1)

    db.prepare(
      `INSERT INTO recebimento (renda_id, valor_centavos, data_esperada)
       VALUES (?, ?, ?)`
    ).run(1, 500000, '2026-06-01')

    const recebimentos = db
      .prepare('SELECT * FROM recebimento WHERE renda_id = 1')
      .all() as unknown[]
    expect(recebimentos).toHaveLength(1)
  })

  it('checksum estavel: bundle reaplica todas as migrations e nao detecta tampering', () => {
    runMigrations(db)

    const files = loadBundledMigrations()
    expect(files.map((f) => f.version)).toEqual([
      '0001_initial_schema',
      '0002_simplificacao_pre_slice_13',
      '0003_drop_colunas_mortas',
      '0004_normaliza_data_referencia',
      '0005_orcamento',
      '0006_backfill_parcelas_pagas'
    ])

    const second = runMigrations(db, files)
    expect(second.applied).toEqual([])
    expect(second.skipped).toHaveLength(6)
  })

  it('preserva categoria + renda inseridas antes do upgrade (simulacao real)', () => {
    // Simula um banco que ja rodou ate 0002 mas nao tem 0003
    const todas = loadBundledMigrations()
    const ate0002 = todas.filter((m) => m.version <= '0002_simplificacao_pre_slice_13')
    runMigrations(db, ate0002)

    // 0002 ainda mantem icone e categoria_id
    db.prepare(
      'INSERT INTO categoria (id, nome, tipo, cor, icone, ativo) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(7, 'Lazer', 'Despesa', '#f0a', 'movie')

    db.prepare(
      `INSERT INTO renda (id, nome, categoria_id, tipo, valor_padrao_centavos, dia_esperado)
       VALUES (?, ?, ?, 'Recorrente', ?, ?)`
    ).run(3, 'Mesada', null, 30000, 15)

    // Aplica 0003
    runMigrations(db, todas)

    const cat = db.prepare('SELECT id, nome, tipo, cor FROM categoria WHERE id = 7').get() as {
      id: number
      nome: string
    }
    expect(cat).toEqual({ id: 7, nome: 'Lazer', tipo: 'Despesa', cor: '#f0a' })

    const renda = db
      .prepare('SELECT id, nome, tipo, dia_esperado FROM renda WHERE id = 3')
      .get() as {
      id: number
      nome: string
    }
    expect(renda).toEqual({ id: 3, nome: 'Mesada', tipo: 'Recorrente', dia_esperado: 15 })
  })

  it('upgrade de 0002→0003 com FK referencing populadas nao quebra (regressao Slice 15)', () => {
    // Reproduz o cenario que falhou em runtime: banco com dados de uso real
    // que tinham despesa.categoria_id e recebimento.renda_id apontando para
    // tabelas que serao dropadas+recriadas. Primeira versao da 0003 usava
    // defer_foreign_keys e falhava com "database is locked" porque DROP TABLE
    // de tabela referenciada por FK ativa nao e permitido — apenas a
    // checagem de violacao e adiada, nao o lock estrutural.
    const todas = loadBundledMigrations()
    const ate0002 = todas.filter((m) => m.version <= '0002_simplificacao_pre_slice_13')
    runMigrations(db, ate0002)

    // Setup: cartao + categoria + despesa apontando para categoria + renda +
    // recebimento apontando para renda. Replica a shape do banco real.
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, ?, 5, 12, ?)'
    ).run('Inter', '#f60')
    db.prepare('INSERT INTO categoria (id, nome, tipo, cor, icone) VALUES (?, ?, ?, ?, ?)').run(
      10,
      'Mercado',
      'Despesa',
      '#fa0',
      'cart'
    )
    db.prepare(
      `INSERT INTO despesa (id, descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
       VALUES (100, 'Compra', 10, 'Unica', 'Credito', 1, 5000, 1, '2026-05-01')`
    ).run()
    db.prepare(
      `INSERT INTO renda (id, nome, categoria_id, tipo, valor_padrao_centavos, dia_esperado)
       VALUES (50, 'Bolsa', NULL, 'Recorrente', 100000, 5)`
    ).run()
    db.prepare(
      `INSERT INTO recebimento (id, renda_id, valor_centavos, data_esperada)
       VALUES (200, 50, 100000, '2026-06-05')`
    ).run()

    // Aplica 0003 — antes do fix, isso quebrava aqui
    expect(() => runMigrations(db, todas)).not.toThrow()

    // Dados preservados
    expect(db.prepare('SELECT COUNT(*) c FROM categoria').get()).toEqual({ c: 1 })
    expect(db.prepare('SELECT COUNT(*) c FROM renda').get()).toEqual({ c: 1 })
    expect(db.prepare('SELECT COUNT(*) c FROM despesa').get()).toEqual({ c: 1 })
    expect(db.prepare('SELECT COUNT(*) c FROM recebimento').get()).toEqual({ c: 1 })

    // FKs continuam validas (categoria.id=10 e renda.id=50 preservados)
    const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
    expect(fkCheck).toEqual([])

    // foreign_keys foi reativado ao fim da migration
    const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(fk.foreign_keys).toBe(1)
  })
})
