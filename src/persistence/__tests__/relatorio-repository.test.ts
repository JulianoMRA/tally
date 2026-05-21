import { describe, expect, it, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { RecebimentoRepository } from '../repositories/recebimento-repository'
import { RelatorioRepository } from '../repositories/relatorio-repository'
import { RendaRepository } from '../repositories/renda-repository'

function inserirCartao(db: Database, nome: string, dF = 5, dV = 12): number {
  return db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#abc').lastInsertRowid as number
}

function inserirCategoria(db: Database, nome: string, cor = '#000'): number {
  return db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES (?, 'Despesa', ?)")
    .run(nome, cor).lastInsertRowid as number
}

describe('RelatorioRepository.totaisPorCategoriaEmMes (RF-VIS-06)', () => {
  let db: Database
  let repo: RelatorioRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RelatorioRepository(db)
  })

  it('retorna lista vazia para mês sem despesas', () => {
    expect(repo.totaisPorCategoriaEmMes('2026-06')).toEqual([])
  })

  it('agrega parcelas de fatura por categoria ordenadas decrescente', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const mercado = inserirCategoria(db, 'Mercado', '#0a0')
    const lazer = inserirCategoria(db, 'Lazer', '#a0a')
    const despesaRepo = new DespesaRepository(db)

    despesaRepo.criarUnicaCredito({
      descricao: 'Compra A',
      categoriaId: mercado,
      cartaoId,
      valorCentavos: 5000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaCredito({
      descricao: 'Cinema',
      categoriaId: lazer,
      cartaoId,
      valorCentavos: 2000,
      dataCompra: '2026-06-04'
    })

    const r = repo.totaisPorCategoriaEmMes('2026-06')
    expect(r).toEqual([
      { categoriaId: mercado, categoriaNome: 'Mercado', cor: '#0a0', totalCentavos: 5000 },
      { categoriaId: lazer, categoriaNome: 'Lazer', cor: '#a0a', totalCentavos: 2000 }
    ])
  })

  it('combina parcelas de fatura + gastos fora cartão no mesmo mês', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const mercado = inserirCategoria(db, 'Mercado')
    const despesaRepo = new DespesaRepository(db)

    despesaRepo.criarUnicaCredito({
      descricao: 'Compra credito',
      categoriaId: mercado,
      cartaoId,
      valorCentavos: 3000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaForaCartao({
      descricao: 'Pix mercado',
      categoriaId: mercado,
      formaPagamento: 'Pix',
      valorCentavos: 1500,
      dataCompra: '2026-06-10'
    })

    const r = repo.totaisPorCategoriaEmMes('2026-06')
    expect(r).toHaveLength(1)
    expect(r[0].totalCentavos).toBe(4500)
  })

  it('exclui despesas de outros meses', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const cat = inserirCategoria(db, 'X')
    const despesaRepo = new DespesaRepository(db)
    despesaRepo.criarUnicaCredito({
      descricao: 'Junho',
      categoriaId: cat,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaCredito({
      descricao: 'Julho',
      categoriaId: cat,
      cartaoId,
      valorCentavos: 9999,
      dataCompra: '2026-06-10' // dia 10 > F=5 → fatura julho
    })

    const junho = repo.totaisPorCategoriaEmMes('2026-06')
    expect(junho).toEqual([
      { categoriaId: cat, categoriaNome: 'X', cor: '#000', totalCentavos: 1000 }
    ])
  })
})

describe('RelatorioRepository.evolucaoSaldoMensal (RF-VIS-05)', () => {
  let db: Database
  let repo: RelatorioRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RelatorioRepository(db)
  })

  it('gera N meses com zeros quando não há dados', () => {
    const r = repo.evolucaoSaldoMensal('2026-06', 6)
    expect(r).toHaveLength(6)
    for (const p of r) {
      expect(p.entradasCentavos).toBe(0)
      expect(p.saidasCentavos).toBe(0)
      expect(p.saldoCentavos).toBe(0)
    }
    expect(r[0].mes).toBe('2026-01')
    expect(r[5].mes).toBe('2026-06')
  })

  it('soma entradas (recebido) e saídas (parcelas + fora cartão) por mês', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const cat = inserirCategoria(db, 'Geral')
    const despesaRepo = new DespesaRepository(db)
    const rendaRepo = new RendaRepository(db)
    const recebimentoRepo = new RecebimentoRepository(db)

    // Junho: gasta 1000 + 500 fora cartão; recebe 2000
    despesaRepo.criarUnicaCredito({
      descricao: 'A',
      categoriaId: cat,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaForaCartao({
      descricao: 'Pix',
      categoriaId: cat,
      formaPagamento: 'Pix',
      valorCentavos: 500,
      dataCompra: '2026-06-15'
    })
    const r = rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 2000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })
    recebimentoRepo.marcarRecebido(r.recebimentos[0].id, '2026-06-05')

    const serie = repo.evolucaoSaldoMensal('2026-06', 3)
    const junho = serie[serie.length - 1]
    expect(junho.mes).toBe('2026-06')
    expect(junho.entradasCentavos).toBe(2000)
    expect(junho.saidasCentavos).toBe(1500)
    expect(junho.saldoCentavos).toBe(500)
  })
})

describe('RelatorioRepository.evolucaoCategoriaMensal (RF-VIS-06)', () => {
  let db: Database
  let repo: RelatorioRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RelatorioRepository(db)
  })

  it('retorna zero em meses sem gastos da categoria', () => {
    const cat = inserirCategoria(db, 'Sem gastos')
    const r = repo.evolucaoCategoriaMensal(cat, '2026-06', 3)
    expect(r).toEqual([
      { mes: '2026-04', totalCentavos: 0 },
      { mes: '2026-05', totalCentavos: 0 },
      { mes: '2026-06', totalCentavos: 0 }
    ])
  })

  it('soma apenas a categoria pedida, ignorando outras', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const mercado = inserirCategoria(db, 'Mercado')
    const lazer = inserirCategoria(db, 'Lazer')
    const despesaRepo = new DespesaRepository(db)

    despesaRepo.criarUnicaCredito({
      descricao: 'Compra mercado',
      categoriaId: mercado,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaCredito({
      descricao: 'Cinema',
      categoriaId: lazer,
      cartaoId,
      valorCentavos: 9999,
      dataCompra: '2026-06-04'
    })

    const r = repo.evolucaoCategoriaMensal(mercado, '2026-06', 2)
    expect(r).toEqual([
      { mes: '2026-05', totalCentavos: 0 },
      { mes: '2026-06', totalCentavos: 1000 }
    ])
  })
})
