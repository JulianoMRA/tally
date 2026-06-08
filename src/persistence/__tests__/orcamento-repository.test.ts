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

  it('definirLimite cria limite global e findByCategoria recupera (mes NULL)', () => {
    const cat = categorias.create({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    repo.definirLimite(cat.id, 50000)
    const orc = repo.findByCategoria(cat.id)
    expect(orc?.valorLimiteCentavos).toBe(50000)
    expect(orc?.mesReferencia).toBeNull()
  })

  it('definirLimite e idempotente: atualiza o mesmo registro sem duplicar', () => {
    const cat = categorias.create({ nome: 'Lazer', tipo: 'Despesa', cor: '#2196f3' })
    repo.definirLimite(cat.id, 20000)
    repo.definirLimite(cat.id, 30000)
    expect(repo.findByCategoria(cat.id)?.valorLimiteCentavos).toBe(30000)
    const count = db.prepare('SELECT COUNT(*) AS n FROM orcamento').get() as { n: number }
    expect(count.n).toBe(1)
  })

  it('listarLimitesGlobais junta nome e cor da categoria, ordenado por nome', () => {
    const mercado = categorias.create({ nome: 'Mercado', tipo: 'Despesa', cor: '#4caf50' })
    const aluguel = categorias.create({ nome: 'Aluguel', tipo: 'Despesa', cor: '#f44336' })
    repo.definirLimite(mercado.id, 50000)
    repo.definirLimite(aluguel.id, 120000)
    expect(repo.listarLimitesGlobais()).toEqual([
      { categoriaId: aluguel.id, categoriaNome: 'Aluguel', cor: '#f44336', limiteCentavos: 120000 },
      { categoriaId: mercado.id, categoriaNome: 'Mercado', cor: '#4caf50', limiteCentavos: 50000 }
    ])
  })

  it('removerLimite apaga o limite da categoria', () => {
    const cat = categorias.create({ nome: 'Saude', tipo: 'Despesa', cor: '#e91e63' })
    repo.definirLimite(cat.id, 10000)
    repo.removerLimite(cat.id)
    expect(repo.findByCategoria(cat.id)).toBeNull()
  })
})
