import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { CartaoRepository } from '../repositories/cartao-repository'

describe('CartaoRepository', () => {
  let db: Database
  let repo: CartaoRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new CartaoRepository(db)
  })

  describe('create', () => {
    it('devolve entidade com id, ativo true e timestamps preenchidos', () => {
      const cartao = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })

      expect(cartao.id).toBeTypeOf('number')
      expect(cartao.nome).toBe('Inter')
      expect(cartao.diaFechamento).toBe(5)
      expect(cartao.diaVencimento).toBe(12)
      expect(cartao.cor).toBe('#ff7a00')
      expect(cartao.ativo).toBe(true)
      expect(cartao.createdAt).toBeTruthy()
      expect(cartao.updatedAt).toBeTruthy()
    })
  })

  describe('findById', () => {
    it('devolve null para id inexistente', () => {
      expect(repo.findById(999)).toBeNull()
    })

    it('devolve o cartão pelo id', () => {
      const criado = repo.create({
        nome: 'Nubank',
        diaFechamento: 15,
        diaVencimento: 22,
        cor: '#820ad1'
      })
      const encontrado = repo.findById(criado.id)

      expect(encontrado?.id).toBe(criado.id)
      expect(encontrado?.nome).toBe('Nubank')
    })
  })

  describe('list', () => {
    it('retorna apenas cartões ativos por padrão, ordenados por nome', () => {
      repo.create({ nome: 'Nubank', diaFechamento: 15, diaVencimento: 22, cor: '#820ad1' })
      repo.create({ nome: 'Inter', diaFechamento: 5, diaVencimento: 12, cor: '#ff7a00' })

      const lista = repo.list()

      expect(lista).toHaveLength(2)
      expect(lista[0].nome).toBe('Inter')
      expect(lista[1].nome).toBe('Nubank')
    })

    it('exclui arquivados da listagem padrão', () => {
      const inter = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })
      repo.create({ nome: 'Nubank', diaFechamento: 15, diaVencimento: 22, cor: '#820ad1' })
      repo.arquivar(inter.id)

      const lista = repo.list()

      expect(lista).toHaveLength(1)
      expect(lista[0].nome).toBe('Nubank')
    })

    it('inclui arquivados quando solicitado', () => {
      const inter = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })
      repo.arquivar(inter.id)

      const lista = repo.list({ incluirArquivados: true })

      expect(lista).toHaveLength(1)
      expect(lista[0].ativo).toBe(false)
    })
  })

  describe('update', () => {
    it('atualiza campos e retorna nova entidade', () => {
      const criado = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })

      const atualizado = repo.update(criado.id, {
        nome: 'Inter Black',
        diaFechamento: 3,
        diaVencimento: 10,
        cor: '#000000'
      })

      expect(atualizado.nome).toBe('Inter Black')
      expect(atualizado.diaFechamento).toBe(3)
      expect(atualizado.diaVencimento).toBe(10)
      expect(atualizado.cor).toBe('#000000')
    })

    it('updatedAt é maior ou igual ao createdAt após update', () => {
      const criado = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })
      const atualizado = repo.update(criado.id, {
        nome: 'Inter Black',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })

      expect(atualizado.updatedAt >= criado.createdAt).toBe(true)
    })

    it('lança erro para id inexistente', () => {
      expect(() =>
        repo.update(999, { nome: 'X', diaFechamento: 1, diaVencimento: 1, cor: '#000000' })
      ).toThrow()
    })
  })

  describe('arquivar / desarquivar', () => {
    it('arquivar define ativo = false', () => {
      const cartao = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })

      const arquivado = repo.arquivar(cartao.id)

      expect(arquivado.ativo).toBe(false)
    })

    it('arquivado some da list() padrão', () => {
      const cartao = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })
      repo.arquivar(cartao.id)

      expect(repo.list()).toHaveLength(0)
    })

    it('desarquivar define ativo = true e volta na list() padrão', () => {
      const cartao = repo.create({
        nome: 'Inter',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#ff7a00'
      })
      repo.arquivar(cartao.id)

      const reativado = repo.desarquivar(cartao.id)

      expect(reativado.ativo).toBe(true)
      expect(repo.list()).toHaveLength(1)
    })
  })
})
