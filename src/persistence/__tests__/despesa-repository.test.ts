import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'

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

describe('DespesaRepository.criarUnicaCredito', () => {
  let db: Database
  let repo: DespesaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
  })

  it('persiste despesa, fatura e parcela 1/1 retornando os três objetos', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const resultado = repo.criarUnicaCredito({
      descricao: 'Supermercado',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 8000,
      dataCompra: '2026-06-03'
    })

    expect(resultado.despesa.id).toBeGreaterThan(0)
    expect(resultado.despesa.descricao).toBe('Supermercado')
    expect(resultado.despesa.tipo).toBe('Unica')
    expect(resultado.despesa.formaPagamento).toBe('Credito')
    expect(resultado.despesa.cartaoId).toBe(cartaoId)
    expect(resultado.despesa.valorCentavos).toBe(8000)
    expect(resultado.despesa.totalParcelas).toBe(1)
    expect(resultado.despesa.ativa).toBe(true)

    expect(resultado.fatura.cartaoId).toBe(cartaoId)
    expect(resultado.fatura.mesReferencia).toBe('2026-06') // dia 03 <= F=05 → mesmo mês
    expect(resultado.fatura.status).toEqual({ kind: 'Aberta' })

    expect(resultado.parcela.despesaId).toBe(resultado.despesa.id)
    expect(resultado.parcela.faturaId).toBe(resultado.fatura.id)
    expect(resultado.parcela.numero).toBe(1)
    expect(resultado.parcela.total).toBe(1)
    expect(resultado.parcela.valorCentavos).toBe(8000)
    expect(resultado.parcela.dataReferencia).toBe('2026-06-03')
    expect(resultado.parcela.status).toBe('Pendente')
  })

  it('RN-01: compra após fechamento cria fatura no mês seguinte', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const resultado = repo.criarUnicaCredito({
      descricao: 'Farmácia',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 3000,
      dataCompra: '2026-06-07' // dia 07 > F=05 → fatura julho
    })

    expect(resultado.fatura.mesReferencia).toBe('2026-07')
  })

  it('duas despesas no mesmo ciclo reutilizam a mesma fatura (idempotência)', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const r1 = repo.criarUnicaCredito({
      descricao: 'Despesa A',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    const r2 = repo.criarUnicaCredito({
      descricao: 'Despesa B',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2000,
      dataCompra: '2026-06-04'
    })

    expect(r2.fatura.id).toBe(r1.fatura.id)

    const faturasInter = db
      .prepare('SELECT count(*) as n FROM fatura WHERE cartao_id = ?')
      .get(cartaoId) as { n: number }
    expect(faturasInter.n).toBe(1)
  })

  it('operação é atômica: falha ao criar parcela reverte despesa e fatura', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    // Forçar falha no insert de parcela com valor_centavos negativo (viola CHECK)
    expect(() =>
      repo.criarUnicaCredito({
        descricao: 'Vai falhar',
        categoriaId: catId,
        cartaoId,
        valorCentavos: -1, // viola CHECK valor_centavos >= 0
        dataCompra: '2026-06-03'
      })
    ).toThrow()

    const despesas = db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }
    expect(despesas.n).toBe(0)
  })
})
