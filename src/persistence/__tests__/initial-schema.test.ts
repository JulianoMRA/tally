import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'

const EXPECTED_TABLES = [
  'cartao',
  'categoria',
  'despesa',
  'fatura',
  'orcamento',
  'parcela',
  'recebimento',
  'renda',
  'schema_migrations'
]

function listTables(db: Database): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[]
  ).map((r) => r.name)
}

describe('migration 0001_initial_schema', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
  })

  it('cria as 8 tabelas de dados + schema_migrations apos as migrations', () => {
    expect(listTables(db)).toEqual(EXPECTED_TABLES)
  })

  it('migration 0003 dropou categoria.icone e renda.categoria_id (colunas mortas pos Slice 12.1)', () => {
    const colsCategoria = (
      db.prepare('PRAGMA table_info(categoria)').all() as { name: string }[]
    ).map((c) => c.name)
    expect(colsCategoria).not.toContain('icone')
    expect(colsCategoria).toEqual([
      'id',
      'nome',
      'tipo',
      'cor',
      'ativo',
      'created_at',
      'updated_at'
    ])

    const colsRenda = (db.prepare('PRAGMA table_info(renda)').all() as { name: string }[]).map(
      (c) => c.name
    )
    expect(colsRenda).not.toContain('categoria_id')
    expect(colsRenda).toEqual([
      'id',
      'nome',
      'tipo',
      'valor_padrao_centavos',
      'dia_esperado',
      'ativa',
      'created_at',
      'updated_at'
    ])
  })

  it('migration 0002 removeu as tabelas ajuda e contribuidor', () => {
    const tables = listTables(db)
    expect(tables).not.toContain('ajuda')
    expect(tables).not.toContain('contribuidor')
  })

  it('aplica todas as constraints essenciais', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
        )
        .run('Inter', 32, 12, '#f60')
    ).toThrow()

    expect(() =>
      db
        .prepare(
          'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
        )
        .run('Inter', 5, 0, '#f60')
    ).toThrow()
  })

  it('rejeita status inválido em fatura', () => {
    db.prepare(
      'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
    ).run('Inter', 5, 12, '#f60')

    expect(() =>
      db
        .prepare(
          'INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, ?, ?, ?, ?)'
        )
        .run(1, '2026-06', '2026-06-05', '2026-06-12', 'Inexistente')
    ).toThrow()
  })

  it('exige cartao_id quando forma_pagamento é Credito e proíbe quando não é', () => {
    db.prepare('INSERT INTO categoria (nome, tipo, cor) VALUES (?, ?, ?)').run(
      'Lazer',
      'Despesa',
      '#000'
    )
    db.prepare(
      'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
    ).run('Inter', 5, 12, '#f60')

    expect(() =>
      db
        .prepare(
          'INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('Spotify', 1, 'Assinatura', 'Credito', null, 2199, '2026-06-01')
    ).toThrow()

    expect(() =>
      db
        .prepare(
          'INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('Almoço', 1, 'Unica', 'Pix', 1, 4500, '2026-06-01')
    ).toThrow()
  })

  it('exige dia_esperado para renda Recorrente e aceita NULL para Avulsa', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado) VALUES (?, ?, ?, ?)'
        )
        .run('Bolsa PET', 'Recorrente', 100000, null)
    ).toThrow()

    expect(() =>
      db
        .prepare(
          'INSERT INTO renda (nome, tipo, valor_padrao_centavos, dia_esperado) VALUES (?, ?, ?, ?)'
        )
        .run('Freela', 'Avulsa', 50000, null)
    ).not.toThrow()
  })

  it('respeita UNIQUE(cartao_id, mes_referencia) em fatura', () => {
    db.prepare(
      'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)'
    ).run('Inter', 5, 12, '#f60')

    const insertFatura = db.prepare(
      'INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, ?, ?, ?, ?)'
    )

    insertFatura.run(1, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')
    expect(() => insertFatura.run(1, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')).toThrow()
  })

  it('e idempotente quando rodada repetidamente', () => {
    const second = runMigrations(db)
    expect(second.applied).toEqual([])
    expect(second.skipped).toEqual([
      '0001_initial_schema',
      '0002_simplificacao_pre_slice_13',
      '0003_drop_colunas_mortas',
      '0004_normaliza_data_referencia',
      '0005_orcamento'
    ])
  })
})
