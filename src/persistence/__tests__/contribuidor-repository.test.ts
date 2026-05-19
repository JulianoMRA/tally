import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { ContribuidorRepository } from '../repositories/contribuidor-repository'

describe('ContribuidorRepository', () => {
  let db: Database
  let repo: ContribuidorRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new ContribuidorRepository(db)
  })

  describe('create', () => {
    it('persiste com nome e contato, ativo=true', () => {
      const c = repo.create({ nome: 'Mãe', contato: 'mae@exemplo.com' })

      expect(c.id).toBeTypeOf('number')
      expect(c.nome).toBe('Mãe')
      expect(c.contato).toBe('mae@exemplo.com')
      expect(c.ativo).toBe(true)
      expect(c.createdAt).toBeTruthy()
    })

    it('aceita contato nulo', () => {
      const c = repo.create({ nome: 'Pai', contato: null })
      expect(c.contato).toBeNull()
    })

    it('aceita contato omitido (undefined → null)', () => {
      const c = repo.create({ nome: 'Avó' } as { nome: string; contato?: string | null })
      expect(c.contato).toBeNull()
    })
  })

  describe('findById', () => {
    it('null para id inexistente', () => {
      expect(repo.findById(9999)).toBeNull()
    })

    it('retorna o contribuidor pelo id', () => {
      const c = repo.create({ nome: 'Amigo', contato: null })
      expect(repo.findById(c.id)?.nome).toBe('Amigo')
    })
  })

  describe('list', () => {
    it('retorna apenas ativos por padrão, ordenado por nome', () => {
      repo.create({ nome: 'Beatriz', contato: null })
      repo.create({ nome: 'Ana', contato: null })

      const lista = repo.list()
      expect(lista.map((c) => c.nome)).toEqual(['Ana', 'Beatriz'])
    })

    it('exclui arquivados quando incluirArquivados=false (default)', () => {
      const a = repo.create({ nome: 'A', contato: null })
      repo.create({ nome: 'B', contato: null })
      repo.arquivar(a.id)

      expect(repo.list()).toHaveLength(1)
      expect(repo.list()[0].nome).toBe('B')
    })

    it('incluirArquivados=true traz todos', () => {
      const a = repo.create({ nome: 'A', contato: null })
      repo.create({ nome: 'B', contato: null })
      repo.arquivar(a.id)

      const todos = repo.list({ incluirArquivados: true })
      expect(todos).toHaveLength(2)
    })
  })

  describe('update', () => {
    it('atualiza nome e contato', () => {
      const c = repo.create({ nome: 'Antigo', contato: 'old@x.com' })
      const u = repo.update(c.id, { nome: 'Novo', contato: 'new@x.com' })

      expect(u.nome).toBe('Novo')
      expect(u.contato).toBe('new@x.com')
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.update(9999, { nome: 'X', contato: null })).toThrow()
    })
  })

  describe('arquivar/desarquivar', () => {
    it('arquivar muda ativo para false', () => {
      const c = repo.create({ nome: 'X', contato: null })
      const r = repo.arquivar(c.id)
      expect(r.ativo).toBe(false)
    })

    it('desarquivar muda ativo para true', () => {
      const c = repo.create({ nome: 'X', contato: null })
      repo.arquivar(c.id)
      const r = repo.desarquivar(c.id)
      expect(r.ativo).toBe(true)
    })
  })
})
