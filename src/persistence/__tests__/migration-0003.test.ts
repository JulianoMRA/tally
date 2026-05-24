import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Slice 15 — valida que a migration 0003 preserva dados ao dropar
 * colunas mortas via recreate-table + defer_foreign_keys.
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

  it('checksum estavel: bundle reaplica 3 migrations e nao detecta tampering', () => {
    runMigrations(db)

    const files = loadBundledMigrations()
    expect(files.map((f) => f.version)).toEqual([
      '0001_initial_schema',
      '0002_simplificacao_pre_slice_13',
      '0003_drop_colunas_mortas'
    ])

    const second = runMigrations(db, files)
    expect(second.applied).toEqual([])
    expect(second.skipped).toHaveLength(3)
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
})
