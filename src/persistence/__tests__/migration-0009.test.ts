import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations, loadBundledMigrations } from '../migrations/runner'

/**
 * Backfill do vencimento anterior ao fechamento: valida que a 0009 empurra o
 * vencimento das faturas gravadas com V < F para o mês seguinte (com clamp de
 * fim de mês) e não encosta nas faturas que já estavam corretas.
 */
describe('migration 0009_corrige_vencimento_anterior_ao_fechamento', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
  })

  function aplicarAte0008(): void {
    const todas = loadBundledMigrations()
    const anteriores = todas.filter((m) => m.version < '0009')
    runMigrations(db, anteriores)
  }

  function aplicar0009(): void {
    runMigrations(db)
  }

  function inserirCartao(id: number, nome: string, fechamento: number, vencimento: number): void {
    db.prepare(
      'INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?, ?)'
    ).run(id, nome, fechamento, vencimento, '#000')
  }

  function inserirFatura(
    cartaoId: number,
    mesReferencia: string,
    dataFechamento: string,
    dataVencimento: string
  ): void {
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, ?, ?, ?, 'Aberta')`
    ).run(cartaoId, mesReferencia, dataFechamento, dataVencimento)
  }

  function vencimentoDe(mesReferencia: string): string {
    const row = db
      .prepare('SELECT data_vencimento FROM fatura WHERE mes_referencia = ?')
      .get(mesReferencia) as { data_vencimento: string }
    return row.data_vencimento
  }

  it('empurra o vencimento para o mês seguinte no cartão que fecha 24 e vence 01', () => {
    aplicarAte0008()
    inserirCartao(1, 'Cartao24', 24, 1)
    inserirFatura(1, '2026-08', '2026-08-24', '2026-08-01')
    inserirFatura(1, '2026-12', '2026-12-24', '2026-12-01')

    aplicar0009()

    expect(vencimentoDe('2026-08')).toBe('2026-09-01')
    expect(vencimentoDe('2026-12')).toBe('2027-01-01')
  })

  it('clampa o vencimento ao último dia do mês quando o dia não existe', () => {
    aplicarAte0008()
    inserirCartao(1, 'Cartao31', 31, 30)
    inserirFatura(1, '2027-01', '2027-01-31', '2027-01-30')

    aplicar0009()

    expect(vencimentoDe('2027-01')).toBe('2027-02-28')
  })

  it('não altera faturas cujo vencimento já é posterior ao fechamento', () => {
    aplicarAte0008()
    inserirCartao(1, 'Inter', 5, 12)
    inserirFatura(1, '2026-06', '2026-06-05', '2026-06-12')

    aplicar0009()

    expect(vencimentoDe('2026-06')).toBe('2026-06-12')
  })

  it('não altera faturas em que fechamento e vencimento caem no mesmo dia', () => {
    aplicarAte0008()
    inserirCartao(1, 'MesmoDia', 10, 10)
    inserirFatura(1, '2026-06', '2026-06-10', '2026-06-10')

    aplicar0009()

    expect(vencimentoDe('2026-06')).toBe('2026-06-10')
  })

  it('preserva status, ids e vínculos das faturas corrigidas', () => {
    aplicarAte0008()
    inserirCartao(1, 'Cartao24', 24, 1)
    db.prepare(
      `INSERT INTO fatura (id, cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento)
       VALUES (99, 1, '2026-07', '2026-07-24', '2026-07-01', 'Paga', '2026-08-01')`
    ).run()

    aplicar0009()

    const fatura = db.prepare('SELECT * FROM fatura WHERE id = 99').get() as {
      cartao_id: number
      status: string
      data_pagamento: string
      data_vencimento: string
    }
    expect(fatura).toMatchObject({
      cartao_id: 1,
      status: 'Paga',
      data_pagamento: '2026-08-01',
      data_vencimento: '2026-08-01'
    })
  })

  it('corrige apenas o cartão afetado quando há cartões dos dois tipos', () => {
    aplicarAte0008()
    inserirCartao(1, 'Cartao24', 24, 1)
    inserirCartao(2, 'Inter', 5, 12)
    inserirFatura(1, '2026-08', '2026-08-24', '2026-08-01')
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (2, '2026-08', '2026-08-05', '2026-08-12', 'Aberta')`
    ).run()

    aplicar0009()

    const vencimentos = db
      .prepare('SELECT cartao_id, data_vencimento FROM fatura ORDER BY cartao_id')
      .all() as { cartao_id: number; data_vencimento: string }[]
    expect(vencimentos).toEqual([
      { cartao_id: 1, data_vencimento: '2026-09-01' },
      { cartao_id: 2, data_vencimento: '2026-08-12' }
    ])
  })
})
