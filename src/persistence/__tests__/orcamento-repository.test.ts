import { beforeEach, describe, expect, it } from 'vitest'
import { openInMemoryDatabase, type Database } from '../database'
import { runMigrations } from '../migrations/runner'
import { CategoriaRepository } from '../repositories/categoria-repository'
import { OrcamentoRepository } from '../repositories/orcamento-repository'

describe('OrcamentoRepository', () => {
  let db: Database
  let repo: OrcamentoRepository
  let categorias: CategoriaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new OrcamentoRepository(db)
    categorias = new CategoriaRepository(db)
  })

  it('definirLimite global (mes null) cria e findByCategoria recupera', () => {
    const cat = categorias.create({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    repo.definirLimite(cat.id, 50000, null)
    const orc = repo.findByCategoria(cat.id, null)
    expect(orc?.valorLimiteCentavos).toBe(50000)
    expect(orc?.mesReferencia).toBeNull()
  })

  it('definirLimite global e idempotente: atualiza sem duplicar', () => {
    const cat = categorias.create({ nome: 'Lazer', tipo: 'Despesa', cor: '#2196f3' })
    repo.definirLimite(cat.id, 20000, null)
    repo.definirLimite(cat.id, 30000, null)
    expect(repo.findByCategoria(cat.id, null)?.valorLimiteCentavos).toBe(30000)
    const count = db.prepare('SELECT COUNT(*) AS n FROM orcamento').get() as { n: number }
    expect(count.n).toBe(1)
  })

  it('definirLimite mensal convive com o global da mesma categoria', () => {
    const cat = categorias.create({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    repo.definirLimite(cat.id, 50000, null)
    repo.definirLimite(cat.id, 80000, '2026-12')

    expect(repo.findByCategoria(cat.id, null)?.valorLimiteCentavos).toBe(50000)
    expect(repo.findByCategoria(cat.id, '2026-12')?.valorLimiteCentavos).toBe(80000)
    const count = db.prepare('SELECT COUNT(*) AS n FROM orcamento').get() as { n: number }
    expect(count.n).toBe(2)
  })

  it('definirLimite mensal e idempotente por (categoria, mes)', () => {
    const cat = categorias.create({ nome: 'Lazer', tipo: 'Despesa', cor: '#2196f3' })
    repo.definirLimite(cat.id, 20000, '2026-12')
    repo.definirLimite(cat.id, 25000, '2026-12')
    expect(repo.findByCategoria(cat.id, '2026-12')?.valorLimiteCentavos).toBe(25000)
    const count = db.prepare('SELECT COUNT(*) AS n FROM orcamento').get() as { n: number }
    expect(count.n).toBe(1)
  })

  it('listarLimitesEfetivos: limite do mes sobrepoe o global, com origem', () => {
    const mercado = categorias.create({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    const aluguel = categorias.create({ nome: 'Aluguel', tipo: 'Despesa', cor: '#f44336' })
    repo.definirLimite(mercado.id, 50000, null)
    repo.definirLimite(mercado.id, 80000, '2026-12') // dezembro estoura o global
    repo.definirLimite(aluguel.id, 120000, null)

    expect(repo.listarLimitesEfetivos('2026-12')).toEqual([
      {
        categoriaId: aluguel.id,
        categoriaNome: 'Aluguel',
        cor: '#f44336',
        limiteCentavos: 120000,
        origem: 'global'
      },
      {
        categoriaId: mercado.id,
        categoriaNome: 'Mercado',
        cor: '#4caf50',
        limiteCentavos: 80000,
        origem: 'mensal'
      }
    ])

    // Em outro mes, vale o global
    expect(repo.listarLimitesEfetivos('2026-11')).toContainEqual(
      expect.objectContaining({ categoriaId: mercado.id, limiteCentavos: 50000, origem: 'global' })
    )
  })

  it('limite apenas mensal aparece somente no proprio mes', () => {
    const cat = categorias.create({ nome: 'Presentes', tipo: 'Despesa', cor: '#9c27b0' })
    repo.definirLimite(cat.id, 30000, '2026-12')

    expect(repo.listarLimitesEfetivos('2026-12')).toContainEqual(
      expect.objectContaining({ categoriaId: cat.id, origem: 'mensal' })
    )
    expect(repo.listarLimitesEfetivos('2026-11')).toEqual([])
  })

  it('removerLimite respeita o escopo (mensal nao apaga o global)', () => {
    const cat = categorias.create({ nome: 'Saude', tipo: 'Despesa', cor: '#e91e63' })
    repo.definirLimite(cat.id, 10000, null)
    repo.definirLimite(cat.id, 15000, '2026-12')

    repo.removerLimite(cat.id, '2026-12')
    expect(repo.findByCategoria(cat.id, '2026-12')).toBeNull()
    expect(repo.findByCategoria(cat.id, null)?.valorLimiteCentavos).toBe(10000)

    repo.removerLimite(cat.id, null)
    expect(repo.findByCategoria(cat.id, null)).toBeNull()
  })
})
