import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { loadBundledMigrations, runMigrations } from '../migrations/runner'

/**
 * Migration 0015 — tabela `pagamento_parcial` (RN-10).
 *
 * Aditiva: só cria a tabela e o índice, sem tocar no que existe. O que estes
 * testes guardam é o que a tabela recusa por construção — pagamento sem valor,
 * com data fora do formato ou pendurado numa fatura que não existe —, porque a
 * importação de dados insere direto no SQL e não passa pelo domínio.
 */
describe('0015_pagamento_parcial', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function aplicarAte0014(): void {
    runMigrations(
      db,
      loadBundledMigrations().filter((m) => m.version < '0015')
    )
  }

  function inserirFatura(): number {
    const cartaoId = Number(
      db
        .prepare(
          "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 24, 1, '#f70')"
        )
        .run().lastInsertRowid
    )
    return Number(
      db
        .prepare(
          `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
           VALUES (?, '2026-10', '2026-10-24', '2026-11-01', 'Aberta')`
        )
        .run(cartaoId).lastInsertRowid
    )
  }

  function inserirPagamento(faturaId: number, valorCentavos: number, dataPagamento: string): void {
    db.prepare(
      'INSERT INTO pagamento_parcial (fatura_id, valor_centavos, data_pagamento) VALUES (?, ?, ?)'
    ).run(faturaId, valorCentavos, dataPagamento)
  }

  it('cria a tabela com as colunas esperadas', () => {
    runMigrations(db)

    const colunas = (
      db.prepare('PRAGMA table_info(pagamento_parcial)').all() as { name: string }[]
    ).map((c) => c.name)
    expect(colunas).toEqual([
      'id',
      'fatura_id',
      'valor_centavos',
      'data_pagamento',
      'created_at',
      'updated_at'
    ])
  })

  // As três leituras do total da fatura somam os pagamentos por fatura.
  it('cria o índice por fatura', () => {
    runMigrations(db)

    const indices = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'pagamento_parcial'"
        )
        .all() as { name: string }[]
    ).map((i) => i.name)
    expect(indices).toContain('idx_pagamento_parcial_fatura')
  })

  it('aceita um pagamento válido, com os timestamps preenchidos', () => {
    runMigrations(db)
    const faturaId = inserirFatura()

    inserirPagamento(faturaId, 20000, '2026-10-10')

    const linha = db.prepare('SELECT * FROM pagamento_parcial').get() as Record<string, unknown>
    expect(linha).toMatchObject({
      fatura_id: faturaId,
      valor_centavos: 20000,
      data_pagamento: '2026-10-10'
    })
    expect(linha.created_at).toBeTruthy()
    expect(linha.updated_at).toBeTruthy()
  })

  it.each([
    ['zero', 0],
    ['negativo', -500]
  ])('recusa valor %s', (_caso, valorCentavos) => {
    runMigrations(db)
    const faturaId = inserirFatura()

    expect(() => inserirPagamento(faturaId, valorCentavos, '2026-10-10')).toThrow(/CHECK/i)
  })

  // Só o formato: se a data existe no calendário é conferido no domínio e no
  // schema do IPC. O CHECK barra o que deixaria de comparar como texto.
  it.each([
    ['em formato brasileiro', '10/10/2026'],
    ['sem o dia', '2026-10'],
    ['vazia', ''],
    ['sem zero à esquerda', '2026-1-1'],
    ['com hora', '2026-10-10T12:00:00']
  ])('recusa data %s', (_caso, dataPagamento) => {
    runMigrations(db)
    const faturaId = inserirFatura()

    expect(() => inserirPagamento(faturaId, 20000, dataPagamento)).toThrow(/CHECK/i)
  })

  it('recusa pagamento sem fatura', () => {
    runMigrations(db)

    expect(() =>
      db
        .prepare(
          "INSERT INTO pagamento_parcial (fatura_id, valor_centavos, data_pagamento) VALUES (NULL, 100, '2026-10-10')"
        )
        .run()
    ).toThrow(/NOT NULL/i)
  })

  it('recusa pagamento em fatura que não existe', () => {
    runMigrations(db)

    expect(() => inserirPagamento(999, 20000, '2026-10-10')).toThrow(/FOREIGN KEY/i)
  })

  // O app nunca apaga fatura, mas a importação de dados apaga todas as tabelas
  // em ordem: é esta restrição que obriga `pagamento_parcial` a ir antes.
  it('não deixa apagar a fatura que tem pagamento', () => {
    runMigrations(db)
    const faturaId = inserirFatura()
    inserirPagamento(faturaId, 20000, '2026-10-10')

    expect(() => db.prepare('DELETE FROM fatura WHERE id = ?').run(faturaId)).toThrow(
      /FOREIGN KEY/i
    )
  })

  it('preserva as faturas que já existiam no upgrade', () => {
    aplicarAte0014()
    const faturaId = inserirFatura()

    const resultado = runMigrations(db)

    expect(resultado.applied).toEqual(['0015_pagamento_parcial'])
    const fatura = db
      .prepare('SELECT mes_referencia, status FROM fatura WHERE id = ?')
      .get(faturaId) as { mes_referencia: string; status: string }
    expect(fatura).toEqual({ mes_referencia: '2026-10', status: 'Aberta' })
    // Nenhuma fatura ganha pagamento por conta da migration.
    expect(db.prepare('SELECT COUNT(*) AS n FROM pagamento_parcial').get()).toEqual({ n: 0 })
  })

  it('rodar de novo não reaplica', () => {
    runMigrations(db)

    const segunda = runMigrations(db)

    expect(segunda.applied).toEqual([])
    expect(segunda.skipped).toContain('0015_pagamento_parcial')
  })

  it('deixa as foreign keys ligadas ao final', () => {
    runMigrations(db)

    const [{ foreign_keys: ligadas }] = db.prepare('PRAGMA foreign_keys').all() as {
      foreign_keys: number
    }[]
    expect(ligadas).toBe(1)
  })
})
