import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { RendaRepository } from '../repositories/renda-repository'

describe('RendaRepository', () => {
  let db: Database
  let repo: RendaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RendaRepository(db)
  })

  describe('criarAvulsa', () => {
    it('persiste tipo Avulsa, dia_esperado nulo, ativa=true', () => {
      const r = repo.criarAvulsa({ nome: 'Freela X', valorPadraoCentavos: 50000 })

      expect(r.tipo).toBe('Avulsa')
      expect(r.diaEsperado).toBeNull()
      expect(r.valorPadraoCentavos).toBe(50000)
      expect(r.ativa).toBe(true)
      expect(r.categoriaId).toBeNull()
    })

    it('aceita categoriaId opcional', () => {
      const catId = db
        .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Freela', 'Renda', '#000')")
        .run().lastInsertRowid as number

      const r = repo.criarAvulsa({
        nome: 'Freela',
        categoriaId: catId,
        valorPadraoCentavos: 30000
      })
      expect(r.categoriaId).toBe(catId)
    })
  })

  describe('criarRecorrente (RF-REN-02)', () => {
    it('cria renda + 12 recebimentos com status Esperado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa PET',
        valorPadraoCentavos: 120000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      expect(r.renda.tipo).toBe('Recorrente')
      expect(r.renda.diaEsperado).toBe(5)
      expect(r.recebimentos).toHaveLength(12)
      for (const rec of r.recebimentos) {
        expect(rec.status).toBe('Esperado')
        expect(rec.valorCentavos).toBe(120000)
        expect(rec.rendaId).toBe(r.renda.id)
        expect(rec.dataRecebida).toBeNull()
      }
    })

    it('primeira data respeita o diaEsperado', () => {
      const r = repo.criarRecorrente({
        nome: 'X',
        valorPadraoCentavos: 1000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })
      expect(r.recebimentos[0].dataEsperada).toBe('2026-06-05')
    })

    it('é atômico — schema CHECK rejeita dia 0 e reverte tudo', () => {
      expect(() =>
        repo.criarRecorrente({
          nome: 'X',
          valorPadraoCentavos: 1000,
          diaEsperado: 0, // viola CHECK do schema mas também o service throw
          dataInicio: '2026-06-01'
        })
      ).toThrow()

      const n = (db.prepare('SELECT count(*) as n FROM renda').get() as { n: number }).n
      expect(n).toBe(0)
    })
  })

  describe('list', () => {
    it('retorna ativas por padrão ordenadas por nome', () => {
      repo.criarAvulsa({ nome: 'Zelda', valorPadraoCentavos: 1000 })
      repo.criarAvulsa({ nome: 'Anna', valorPadraoCentavos: 2000 })

      const lista = repo.list()
      expect(lista.map((r) => r.nome)).toEqual(['Anna', 'Zelda'])
    })

    it('incluirArquivadas=true traz arquivadas também', () => {
      const a = repo.criarAvulsa({ nome: 'A', valorPadraoCentavos: 1000 })
      repo.criarAvulsa({ nome: 'B', valorPadraoCentavos: 2000 })
      repo.arquivar(a.id)

      expect(repo.list()).toHaveLength(1)
      expect(repo.list({ incluirArquivadas: true })).toHaveLength(2)
    })
  })

  describe('update — RF-REN-05', () => {
    it('reajuste do valor padrão afeta recebimentos Esperado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      repo.update(r.renda.id, {
        nome: 'Bolsa',
        categoriaId: null,
        valorPadraoCentavos: 130000
      })

      const recebimentos = db
        .prepare('SELECT * FROM recebimento WHERE renda_id = ?')
        .all(r.renda.id) as { valor_centavos: number; status: string }[]

      for (const rec of recebimentos) {
        expect(rec.valor_centavos).toBe(130000)
      }
    })

    it('não toca em recebimentos Recebido', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      // Marca o primeiro como Recebido
      db.prepare(
        "UPDATE recebimento SET status = 'Recebido', data_recebida = '2026-06-05' WHERE id = ?"
      ).run(r.recebimentos[0].id)

      repo.update(r.renda.id, {
        nome: 'Bolsa',
        categoriaId: null,
        valorPadraoCentavos: 130000
      })

      const primeiro = db
        .prepare('SELECT * FROM recebimento WHERE id = ?')
        .get(r.recebimentos[0].id) as { valor_centavos: number; status: string }
      expect(primeiro.valor_centavos).toBe(100000)
      expect(primeiro.status).toBe('Recebido')
    })

    it('renda Avulsa não tem recebimentos a ajustar', () => {
      const r = repo.criarAvulsa({ nome: 'X', valorPadraoCentavos: 1000 })
      const u = repo.update(r.id, {
        nome: 'X',
        categoriaId: null,
        valorPadraoCentavos: 2000
      })
      expect(u.valorPadraoCentavos).toBe(2000)
    })

    it('lança erro para id inexistente', () => {
      expect(() =>
        repo.update(9999, { nome: 'X', categoriaId: null, valorPadraoCentavos: 1000 })
      ).toThrow()
    })
  })

  describe('arquivar', () => {
    it('apaga recebimentos Esperado e preserva Recebido', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      // Marca o primeiro como Recebido
      db.prepare(
        "UPDATE recebimento SET status = 'Recebido', data_recebida = '2026-06-05' WHERE id = ?"
      ).run(r.recebimentos[0].id)

      const arquivada = repo.arquivar(r.renda.id)
      expect(arquivada.ativa).toBe(false)

      const restantes = db
        .prepare('SELECT * FROM recebimento WHERE renda_id = ?')
        .all(r.renda.id) as { id: number; status: string }[]

      expect(restantes).toHaveLength(1)
      expect(restantes[0].status).toBe('Recebido')
    })
  })

  describe('desarquivar', () => {
    it('volta ativa para true mas não regenera recebimentos', () => {
      const r = repo.criarAvulsa({ nome: 'X', valorPadraoCentavos: 1000 })
      repo.arquivar(r.id)
      const d = repo.desarquivar(r.id)
      expect(d.ativa).toBe(true)
    })
  })
})
