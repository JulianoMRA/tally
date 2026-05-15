import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { ParcelaRepository } from '../repositories/parcela-repository'

function inserirCartao(db: Database.Database, nome: string, dF: number, dV: number): number {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#000')
  return Number(info.lastInsertRowid)
}

function inserirCategoria(db: Database.Database): number {
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Alimentação', 'Despesa', '#aaa')")
    .run()
  return Number(info.lastInsertRowid)
}

function inserirFatura(db: Database.Database, cartaoId: number, mes: string): number {
  const info = db
    .prepare(
      "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, ?, ?, ?, 'Aberta')"
    )
    .run(cartaoId, mes, `${mes}-05`, `${mes}-12`)
  return Number(info.lastInsertRowid)
}

function inserirDespesa(
  db: Database.Database,
  categoriaId: number,
  cartaoId: number,
  dataCompra: string,
  valorCentavos: number
): number {
  const info = db
    .prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra)
       VALUES ('Teste', ?, 'Unica', 'Credito', ?, ?, ?)`
    )
    .run(categoriaId, cartaoId, valorCentavos, dataCompra)
  return Number(info.lastInsertRowid)
}

describe('ParcelaRepository', () => {
  let db: Database.Database
  let repo: ParcelaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new ParcelaRepository(db)
  })

  describe('criar', () => {
    it('persiste a parcela e retorna a entidade com id', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const faturaId = inserirFatura(db, cartaoId, '2026-06')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-06-03', 5000)

      const parcela = repo.criar({
        despesaId,
        faturaId,
        numero: 1,
        total: 1,
        valorCentavos: 5000,
        dataReferencia: '2026-06-03'
      })

      expect(parcela.id).toBeGreaterThan(0)
      expect(parcela.despesaId).toBe(despesaId)
      expect(parcela.faturaId).toBe(faturaId)
      expect(parcela.numero).toBe(1)
      expect(parcela.total).toBe(1)
      expect(parcela.valorCentavos).toBe(5000)
      expect(parcela.dataReferencia).toBe('2026-06-03')
      expect(parcela.status).toBe('Pendente')
      expect(parcela.dataPagamento).toBeNull()
    })

    it('permite faturaId null (despesa fora de cartão, uso futuro)', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-06-03', 1000)

      const parcela = repo.criar({
        despesaId,
        faturaId: null,
        numero: 1,
        total: 1,
        valorCentavos: 1000,
        dataReferencia: '2026-06-03'
      })

      expect(parcela.faturaId).toBeNull()
    })
  })

  describe('listarPorFatura', () => {
    it('retorna todas as parcelas de uma fatura', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const faturaId = inserirFatura(db, cartaoId, '2026-06')
      const d1 = inserirDespesa(db, catId, cartaoId, '2026-06-03', 3000)
      const d2 = inserirDespesa(db, catId, cartaoId, '2026-06-04', 2000)

      repo.criar({
        despesaId: d1,
        faturaId,
        numero: 1,
        total: 1,
        valorCentavos: 3000,
        dataReferencia: '2026-06-03'
      })
      repo.criar({
        despesaId: d2,
        faturaId,
        numero: 1,
        total: 1,
        valorCentavos: 2000,
        dataReferencia: '2026-06-04'
      })

      const parcelas = repo.listarPorFatura(faturaId)
      expect(parcelas).toHaveLength(2)
      expect(parcelas.map((p) => p.valorCentavos)).toEqual(expect.arrayContaining([3000, 2000]))
    })

    it('retorna lista vazia quando fatura não tem parcelas', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const faturaId = inserirFatura(db, cartaoId, '2026-07')
      expect(repo.listarPorFatura(faturaId)).toHaveLength(0)
    })
  })

  describe('listarPorDespesa', () => {
    it('retorna todas as parcelas de uma despesa', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const faturaId = inserirFatura(db, cartaoId, '2026-06')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-06-03', 5000)

      repo.criar({
        despesaId,
        faturaId,
        numero: 1,
        total: 1,
        valorCentavos: 5000,
        dataReferencia: '2026-06-03'
      })

      const parcelas = repo.listarPorDespesa(despesaId)
      expect(parcelas).toHaveLength(1)
      expect(parcelas[0].despesaId).toBe(despesaId)
    })
  })
})
