import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
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

describe('DespesaRepository.criarParceladaCredito (RF-DES-02, RN-02)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let cartaoId: number
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    cartaoId = db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
      .run('Nubank', 15, 22, '#000').lastInsertRowid as number
    catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Eletrônicos', 'Despesa', '#aaa')")
      .run().lastInsertRowid as number
  })

  it('persiste despesa com tipo Parcelada e totalParcelas correto', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-05-01'
    })

    expect(r.despesa.tipo).toBe('Parcelada')
    expect(r.despesa.totalParcelas).toBe(3)
    expect(r.despesa.valorCentavos).toBe(30000)
    expect(r.despesa.formaPagamento).toBe('Credito')
  })

  it('gera exatamente N parcelas no banco', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'TV',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 12,
      valorTotalCentavos: 120000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(12)
  })

  it('parcelas têm numeração sequencial 1/N, 2/N, ..., N/N', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Geladeira',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 4,
      valorTotalCentavos: 40000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    for (let i = 0; i < 4; i++) {
      expect(parcelas[i].numero).toBe(i + 1)
      expect(parcelas[i].total).toBe(4)
    }
  })

  it('cada parcela vinculada a uma fatura com mesReferencia distinto', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Celular',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-05-10' // F=15, compra dia 10 → fatura mai
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    const faturas = parcelas.map((p) => {
      const f = db.prepare('SELECT mes_referencia FROM fatura WHERE id = ?').get(p.faturaId) as {
        mes_referencia: string
      }
      return f.mes_referencia
    })

    expect(faturas).toEqual(['2026-05', '2026-06', '2026-07'])
  })

  it('soma dos valores das parcelas igual ao valorTotalCentavos', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Monitor',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 7,
      valorTotalCentavos: 99999,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    const soma = parcelas.reduce((s, p) => s + p.valorCentavos, 0)
    expect(soma).toBe(99999)
  })

  it('operação é atômica — falha reverte tudo', () => {
    expect(() =>
      repo.criarParceladaCredito({
        descricao: 'Falha',
        categoriaId: catId,
        cartaoId: 9999, // cartão inexistente → FK fail
        totalParcelas: 2,
        valorTotalCentavos: 2000,
        dataCompra: '2026-05-01'
      })
    ).toThrow()

    const n = (db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }).n
    expect(n).toBe(0)
  })
})

describe('DespesaRepository.criarParceladaEmAndamento (RF-DES-03)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let cartaoId: number
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    cartaoId = db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
      .run('Inter', 5, 12, '#000').lastInsertRowid as number
    catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Assinatura', 'Despesa', '#bbb')")
      .run().lastInsertRowid as number
  })

  it('gera apenas as parcelas restantes (K/N..N/N)', () => {
    const r = repo.criarParceladaEmAndamento({
      descricao: 'Notebook parcelado (em andamento)',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 12,
      parcelaAtual: 7,
      valorRestanteCentavos: 6000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(6)
    expect(parcelas[0].numero).toBe(7)
    expect(parcelas[0].total).toBe(12)
    expect(parcelas[5].numero).toBe(12)
  })

  it('despesa salva com totalParcelas = N (número original)', () => {
    const r = repo.criarParceladaEmAndamento({
      descricao: 'Em andamento',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 10,
      parcelaAtual: 9,
      valorRestanteCentavos: 2000,
      dataCompra: '2026-05-01'
    })

    expect(r.despesa.totalParcelas).toBe(10)
  })
})
