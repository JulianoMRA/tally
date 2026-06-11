import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { ParcelaRepository } from '../repositories/parcela-repository'

function inserirCartao(db: Database, nome: string, dF: number, dV: number): number {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#000')
  return Number(info.lastInsertRowid)
}

function inserirCategoria(db: Database): number {
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Alimentação', 'Despesa', '#aaa')")
    .run()
  return Number(info.lastInsertRowid)
}

function inserirFatura(db: Database, cartaoId: number, mes: string): number {
  const info = db
    .prepare(
      "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, ?, ?, ?, 'Aberta')"
    )
    .run(cartaoId, mes, `${mes}-05`, `${mes}-12`)
  return Number(info.lastInsertRowid)
}

function inserirDespesa(
  db: Database,
  categoriaId: number,
  cartaoId: number,
  dataCompra: string,
  valorCentavos: number,
  tipo: 'Unica' | 'Parcelada' | 'Assinatura' = 'Unica'
): number {
  const info = db
    .prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra)
       VALUES ('Teste', ?, ?, 'Credito', ?, ?, ?)`
    )
    .run(categoriaId, tipo, cartaoId, valorCentavos, dataCompra)
  return Number(info.lastInsertRowid)
}

describe('ParcelaRepository', () => {
  let db: Database
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

  describe('adiantar', () => {
    it('move as N parcelas mais futuras para a fatura destino', () => {
      const cartaoId = inserirCartao(db, 'Nubank', 15, 22)
      const catId = inserirCategoria(db)
      const f1 = inserirFatura(db, cartaoId, '2026-05')
      const f2 = inserirFatura(db, cartaoId, '2026-06')
      const f3 = inserirFatura(db, cartaoId, '2026-07')
      const destino = inserirFatura(db, cartaoId, '2026-04')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 3000, 'Parcelada')

      repo.criar({
        despesaId,
        faturaId: f1,
        numero: 1,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })
      repo.criar({
        despesaId,
        faturaId: f2,
        numero: 2,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })
      repo.criar({
        despesaId,
        faturaId: f3,
        numero: 3,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-07-01'
      })

      const resultado = repo.adiantar({ despesaId, quantidade: 2, faturaDestinoId: destino })

      expect(resultado.movidas).toHaveLength(2)
      const numeros = resultado.movidas.map((p) => p.numero).sort((a, b) => a - b)
      expect(numeros).toEqual([2, 3])

      const parcelas = repo.listarPorDespesa(despesaId)
      const noDestino = parcelas.filter((p) => p.faturaId === destino)
      expect(noDestino).toHaveLength(2)
    })

    it('preserva numero e total das parcelas movidas', () => {
      const cartaoId = inserirCartao(db, 'Nubank', 15, 22)
      const catId = inserirCategoria(db)
      const f1 = inserirFatura(db, cartaoId, '2026-05')
      const f2 = inserirFatura(db, cartaoId, '2026-06')
      const destino = inserirFatura(db, cartaoId, '2026-04')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 2000, 'Parcelada')

      repo.criar({
        despesaId,
        faturaId: f1,
        numero: 9,
        total: 12,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })
      repo.criar({
        despesaId,
        faturaId: f2,
        numero: 10,
        total: 12,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })

      const resultado = repo.adiantar({ despesaId, quantidade: 1, faturaDestinoId: destino })

      expect(resultado.movidas[0].numero).toBe(10)
      expect(resultado.movidas[0].total).toBe(12)
      expect(resultado.movidas[0].faturaId).toBe(destino)
    })

    it('retorna faturasAfetadas com ids das faturas origem e destino', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const f1 = inserirFatura(db, cartaoId, '2026-05')
      const f2 = inserirFatura(db, cartaoId, '2026-06')
      const destino = inserirFatura(db, cartaoId, '2026-04')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 2000, 'Parcelada')

      repo.criar({
        despesaId,
        faturaId: f1,
        numero: 1,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })
      repo.criar({
        despesaId,
        faturaId: f2,
        numero: 2,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })

      const resultado = repo.adiantar({ despesaId, quantidade: 1, faturaDestinoId: destino })

      expect(resultado.faturasAfetadas).toContain(f2)
      expect(resultado.faturasAfetadas).toContain(destino)
    })

    it('lança erro para despesa Unica (adiantamento é exclusivo de Parcelada)', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const f1 = inserirFatura(db, cartaoId, '2026-05')
      const destino = inserirFatura(db, cartaoId, '2026-04')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 1000, 'Unica')

      repo.criar({
        despesaId,
        faturaId: f1,
        numero: 1,
        total: 1,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })

      expect(() => repo.adiantar({ despesaId, quantidade: 1, faturaDestinoId: destino })).toThrow(
        /parcelada/i
      )
    })

    it('lança erro para despesa Assinatura', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const f1 = inserirFatura(db, cartaoId, '2026-05')
      const destino = inserirFatura(db, cartaoId, '2026-04')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 1000, 'Assinatura')

      repo.criar({
        despesaId,
        faturaId: f1,
        numero: 1,
        total: null,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })

      expect(() => repo.adiantar({ despesaId, quantidade: 1, faturaDestinoId: destino })).toThrow(
        /parcelada/i
      )
    })

    it('lança erro para despesa inexistente', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const destino = inserirFatura(db, cartaoId, '2026-04')

      expect(() =>
        repo.adiantar({ despesaId: 9999, quantidade: 1, faturaDestinoId: destino })
      ).toThrow(/não encontrada/i)
    })
  })

  describe('cancelarPendentes', () => {
    it('remove parcelas de faturas com status Aberta', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const fAberta = inserirFatura(db, cartaoId, '2026-06')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-06-01', 3000)

      repo.criar({
        despesaId,
        faturaId: fAberta,
        numero: 1,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })
      repo.criar({
        despesaId,
        faturaId: fAberta,
        numero: 2,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-07-01'
      })
      repo.criar({
        despesaId,
        faturaId: fAberta,
        numero: 3,
        total: 3,
        valorCentavos: 1000,
        dataReferencia: '2026-08-01'
      })

      const resultado = repo.cancelarPendentes(despesaId)

      expect(resultado.canceladas).toHaveLength(3)
      expect(repo.listarPorDespesa(despesaId)).toHaveLength(0)
    })

    it('preserva parcelas de faturas Paga', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const fPaga = db
        .prepare(
          "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento) VALUES (?, '2026-05', '2026-05-05', '2026-05-12', 'Paga', '2026-06-01')"
        )
        .run(cartaoId).lastInsertRowid as number
      const fAberta = inserirFatura(db, cartaoId, '2026-06')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 2000)

      repo.criar({
        despesaId,
        faturaId: fPaga,
        numero: 1,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })
      repo.criar({
        despesaId,
        faturaId: fAberta,
        numero: 2,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })

      const resultado = repo.cancelarPendentes(despesaId)

      expect(resultado.canceladas).toHaveLength(1)
      const restantes = repo.listarPorDespesa(despesaId)
      expect(restantes).toHaveLength(1)
      expect(restantes[0].numero).toBe(1)
    })

    it('preserva parcelas de faturas Fechada', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const fFechada = db
        .prepare(
          "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, '2026-05', '2026-05-05', '2026-05-12', 'Fechada')"
        )
        .run(cartaoId).lastInsertRowid as number
      const fAberta = inserirFatura(db, cartaoId, '2026-06')
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 2000)

      repo.criar({
        despesaId,
        faturaId: fFechada,
        numero: 1,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })
      repo.criar({
        despesaId,
        faturaId: fAberta,
        numero: 2,
        total: 2,
        valorCentavos: 1000,
        dataReferencia: '2026-06-01'
      })

      const resultado = repo.cancelarPendentes(despesaId)

      expect(resultado.canceladas).toHaveLength(1)
      expect(resultado.canceladas[0].numero).toBe(2)
    })

    it('retorna lista vazia se não há parcelas pendentes', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const fPaga = db
        .prepare(
          "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento) VALUES (?, '2026-05', '2026-05-05', '2026-05-12', 'Paga', '2026-06-01')"
        )
        .run(cartaoId).lastInsertRowid as number
      const despesaId = inserirDespesa(db, catId, cartaoId, '2026-05-01', 1000)

      repo.criar({
        despesaId,
        faturaId: fPaga,
        numero: 1,
        total: 1,
        valorCentavos: 1000,
        dataReferencia: '2026-05-01'
      })

      const resultado = repo.cancelarPendentes(despesaId)
      expect(resultado.canceladas).toHaveLength(0)
    })
  })
})
