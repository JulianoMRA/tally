import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { RecebimentoRepository } from '../repositories/recebimento-repository'
import { RendaRepository } from '../repositories/renda-repository'

describe('RecebimentoRepository', () => {
  let db: Database
  let repo: RecebimentoRepository
  let rendaRepo: RendaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RecebimentoRepository(db)
    rendaRepo = new RendaRepository(db)
  })

  describe('criar', () => {
    it('persiste com status Esperado por padrão', () => {
      const r = repo.criar({
        rendaId: null,
        valorCentavos: 50000,
        dataEsperada: '2026-06-10'
      })

      expect(r.status).toBe('Esperado')
      expect(r.dataRecebida).toBeNull()
      expect(r.rendaId).toBeNull()
    })

    it('quando dataRecebida informada, persiste como Recebido', () => {
      const r = repo.criar({
        rendaId: null,
        valorCentavos: 50000,
        dataEsperada: '2026-06-10',
        dataRecebida: '2026-06-12'
      })

      expect(r.status).toBe('Recebido')
      expect(r.dataRecebida).toBe('2026-06-12')
    })

    it('valor inválido lança erro', () => {
      expect(() =>
        repo.criar({ rendaId: null, valorCentavos: 0, dataEsperada: '2026-06-10' })
      ).toThrow()
      expect(() =>
        repo.criar({ rendaId: null, valorCentavos: -100, dataEsperada: '2026-06-10' })
      ).toThrow()
    })
  })

  describe('criarAvulsoCompleto (RF-REN-04)', () => {
    it('cria renda Avulsa + recebimento atomicamente', () => {
      const r = repo.criarAvulsoCompleto({
        nome: 'Freela teste',
        valorCentavos: 50000,
        dataEsperada: '2026-06-10',
        dataRecebida: '2026-06-12'
      })

      expect(r.status).toBe('Recebido')
      expect(r.rendaId).not.toBeNull()

      // Renda criada deve existir e ser Avulsa
      const renda = rendaRepo.findById(r.rendaId!)
      expect(renda?.tipo).toBe('Avulsa')
      expect(renda?.nome).toBe('Freela teste')
    })
  })

  describe('listar', () => {
    it('filtra por mesReferencia via data_esperada', () => {
      repo.criar({ rendaId: null, valorCentavos: 1000, dataEsperada: '2026-06-05' })
      repo.criar({ rendaId: null, valorCentavos: 2000, dataEsperada: '2026-07-05' })

      const junho = repo.listar({ mesReferencia: '2026-06' })
      expect(junho).toHaveLength(1)
      expect(junho[0].valorCentavos).toBe(1000)
    })

    it('filtra por status', () => {
      repo.criar({ rendaId: null, valorCentavos: 1000, dataEsperada: '2026-06-05' })
      const r2 = repo.criar({
        rendaId: null,
        valorCentavos: 2000,
        dataEsperada: '2026-06-10'
      })
      repo.marcarRecebido(r2.id, '2026-06-10')

      expect(repo.listar({ status: 'Esperado' })).toHaveLength(1)
      expect(repo.listar({ status: 'Recebido' })).toHaveLength(1)
    })

    it('inclui nome da renda quando vinculado (LEFT JOIN)', () => {
      const renda = rendaRepo.criarAvulsa({ nome: 'Freela A', valorPadraoCentavos: 1000 })
      repo.criar({ rendaId: renda.id, valorCentavos: 1000, dataEsperada: '2026-06-05' })
      repo.criar({ rendaId: null, valorCentavos: 2000, dataEsperada: '2026-06-10' })

      const lista = repo.listar()
      const comRenda = lista.find((r) => r.rendaId === renda.id)
      const semRenda = lista.find((r) => r.rendaId === null)

      expect(comRenda?.rendaNome).toBe('Freela A')
      expect(semRenda?.rendaNome).toBeNull()
    })

    it('ordena por data_esperada asc', () => {
      repo.criar({ rendaId: null, valorCentavos: 1000, dataEsperada: '2026-06-20' })
      repo.criar({ rendaId: null, valorCentavos: 2000, dataEsperada: '2026-06-05' })

      const lista = repo.listar({ mesReferencia: '2026-06' })
      expect(lista[0].dataEsperada).toBe('2026-06-05')
      expect(lista[1].dataEsperada).toBe('2026-06-20')
    })
  })

  describe('marcarRecebido (RF-REN-03)', () => {
    it('atualiza status e data_recebida', () => {
      const r = repo.criar({
        rendaId: null,
        valorCentavos: 1000,
        dataEsperada: '2026-06-05'
      })

      const atualizado = repo.marcarRecebido(r.id, '2026-06-10')
      expect(atualizado.status).toBe('Recebido')
      expect(atualizado.dataRecebida).toBe('2026-06-10')
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.marcarRecebido(9999, '2026-06-10')).toThrow()
    })
  })

  describe('excluir', () => {
    it('remove o recebimento do banco', () => {
      const r = repo.criar({
        rendaId: null,
        valorCentavos: 1000,
        dataEsperada: '2026-06-05'
      })

      repo.excluir(r.id)
      expect(repo.findById(r.id)).toBeNull()
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.excluir(9999)).toThrow()
    })

    it('excluir o último recebimento de renda Avulsa também exclui a renda (sem órfã)', () => {
      const r = repo.criarAvulsoCompleto({
        nome: 'Freela órfã',
        valorCentavos: 50000,
        dataEsperada: '2026-06-10',
        dataRecebida: '2026-06-12'
      })

      repo.excluir(r.id)

      expect(repo.findById(r.id)).toBeNull()
      expect(rendaRepo.findById(r.rendaId!)).toBeNull()
    })

    it('excluir recebimento de renda Avulsa que ainda tem outros recebimentos preserva a renda', () => {
      const r1 = repo.criarAvulsoCompleto({
        nome: 'Freela duplo',
        valorCentavos: 50000,
        dataEsperada: '2026-06-10'
      })
      repo.criar({
        rendaId: r1.rendaId,
        valorCentavos: 30000,
        dataEsperada: '2026-07-10'
      })

      repo.excluir(r1.id)

      expect(rendaRepo.findById(r1.rendaId!)).not.toBeNull()
    })

    it('excluir recebimento de renda Recorrente preserva a renda mesmo sem outros recebimentos', () => {
      const { renda, recebimentos } = rendaRepo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })
      expect(recebimentos.length).toBeGreaterThan(0)

      for (const r of recebimentos) repo.excluir(r.id)

      expect(rendaRepo.findById(renda.id)).not.toBeNull()
    })
  })

  describe('totaisPorMes', () => {
    it('agrupa por status', () => {
      const r1 = repo.criar({
        rendaId: null,
        valorCentavos: 1000,
        dataEsperada: '2026-06-05'
      })
      repo.criar({ rendaId: null, valorCentavos: 2000, dataEsperada: '2026-06-15' })
      repo.marcarRecebido(r1.id, '2026-06-06')

      const totais = repo.totaisPorMes('2026-06')
      expect(totais.totalRecebidoCentavos).toBe(1000)
      expect(totais.totalEsperadoCentavos).toBe(2000)
    })

    it('retorna 0 quando não há recebimentos no mês', () => {
      const totais = repo.totaisPorMes('2026-08')
      expect(totais.totalEsperadoCentavos).toBe(0)
      expect(totais.totalRecebidoCentavos).toBe(0)
    })
  })
})
