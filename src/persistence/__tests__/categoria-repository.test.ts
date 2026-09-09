import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { CategoriaRepository } from '../repositories/categoria-repository'

describe('CategoriaRepository', () => {
  let db: Database
  let repo: CategoriaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new CategoriaRepository(db)
  })

  describe('create', () => {
    it('devolve entidade com id, ativo true e timestamps preenchidos', () => {
      const categoria = repo.create({ nome: 'Mercado', cor: '#4caf50' })

      expect(categoria.id).toBeTypeOf('number')
      expect(categoria.nome).toBe('Mercado')
      expect(categoria.cor).toBe('#4caf50')
      expect(categoria.ativo).toBe(true)
      expect(categoria.createdAt).toBeTruthy()
      expect(categoria.updatedAt).toBeTruthy()
    })
  })

  describe('findById', () => {
    it('devolve null para id inexistente', () => {
      expect(repo.findById(999)).toBeNull()
    })

    it('devolve a categoria pelo id', () => {
      const criada = repo.create({ nome: 'Salário', cor: '#ffeb3b' })
      const encontrada = repo.findById(criada.id)

      expect(encontrada?.id).toBe(criada.id)
      expect(encontrada?.nome).toBe('Salário')
    })
  })

  describe('list', () => {
    it('retorna apenas categorias ativas por padrão, ordenadas por nome', () => {
      repo.create({ nome: 'Transporte', cor: '#2196f3' })
      repo.create({ nome: 'Mercado', cor: '#4caf50' })

      const lista = repo.list()

      expect(lista).toHaveLength(2)
      expect(lista[0].nome).toBe('Mercado')
      expect(lista[1].nome).toBe('Transporte')
    })

    it('exclui arquivadas da listagem padrão', () => {
      const mercado = repo.create({ nome: 'Mercado', cor: '#4caf50' })
      repo.create({ nome: 'Transporte', cor: '#2196f3' })
      repo.arquivar(mercado.id)

      const lista = repo.list()

      expect(lista).toHaveLength(1)
      expect(lista[0].nome).toBe('Transporte')
    })

    it('inclui arquivadas quando solicitado', () => {
      const mercado = repo.create({ nome: 'Mercado', cor: '#4caf50' })
      repo.arquivar(mercado.id)

      const lista = repo.list({ incluirArquivados: true })

      expect(lista).toHaveLength(1)
      expect(lista[0].ativo).toBe(false)
    })
  })

  describe('update', () => {
    it('atualiza campos e retorna nova entidade', () => {
      const criada = repo.create({ nome: 'Mercado', cor: '#4caf50' })

      const atualizada = repo.update(criada.id, { nome: 'Supermercado', cor: '#81c784' })

      expect(atualizada.nome).toBe('Supermercado')
      expect(atualizada.cor).toBe('#81c784')
    })

    it('updatedAt é maior ou igual ao createdAt após update', () => {
      const criada = repo.create({ nome: 'Mercado', cor: '#4caf50' })
      const atualizada = repo.update(criada.id, {
        nome: 'Mercado',
        cor: '#4caf50'
      })

      expect(atualizada.updatedAt >= criada.createdAt).toBe(true)
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.update(999, { nome: 'X', cor: '#000000' })).toThrow()
    })
  })

  describe('arquivar / desarquivar', () => {
    it('arquivar define ativo = false', () => {
      const categoria = repo.create({
        nome: 'Mercado',
        cor: '#4caf50'
      })

      const arquivada = repo.arquivar(categoria.id)

      expect(arquivada.ativo).toBe(false)
    })

    it('arquivada some da list() padrão', () => {
      const categoria = repo.create({
        nome: 'Mercado',
        cor: '#4caf50'
      })
      repo.arquivar(categoria.id)

      expect(repo.list()).toHaveLength(0)
    })

    it('desarquivar define ativo = true e volta na list() padrão', () => {
      const categoria = repo.create({
        nome: 'Mercado',
        cor: '#4caf50'
      })
      repo.arquivar(categoria.id)

      const reativada = repo.desarquivar(categoria.id)

      expect(reativada.ativo).toBe(true)
      expect(repo.list()).toHaveLength(1)
    })
  })
})
