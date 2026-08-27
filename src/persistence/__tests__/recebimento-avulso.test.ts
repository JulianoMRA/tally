import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { RecebimentoRepository } from '../repositories/recebimento-repository'
import { RendaRepository } from '../repositories/renda-repository'

/**
 * Entrada avulsa nao tem fonte de renda.
 *
 * Substitui `recebimento-avulso-fonte.test.ts`, que cobria o modelo anterior:
 * `criarAvulsoCompleto` ou criava uma `renda` Avulsa ou reusava uma existente,
 * porque `recebimento` nao tinha coluna de nome. A migration 0011 deu a ele
 * `descricao` propria, e fonte de renda passou a existir so para entrada
 * constante — nao ha mais vinculo a criar nem a reusar.
 */
describe('Recebimento avulso sem fonte', () => {
  let db: Database
  let repo: RecebimentoRepository
  let rendas: RendaRepository

  function contarRendas(): number {
    return Number((db.prepare('SELECT COUNT(*) AS n FROM renda').get() as { n: number }).n)
  }

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RecebimentoRepository(db)
    rendas = new RendaRepository(db)
  })

  describe('criarAvulso', () => {
    it('grava a descricao na propria linha e nao cria fonte nenhuma', () => {
      const recebimento = repo.criarAvulso({
        descricao: 'Freela de design',
        valorCentavos: 150_000,
        dataEsperada: '2026-08-10'
      })

      expect(recebimento.rendaId).toBeNull()
      expect(recebimento.descricao).toBe('Freela de design')
      expect(contarRendas()).toBe(0)
    })

    it('tres entradas do mesmo cliente continuam sendo tres entradas, e zero fontes', () => {
      // Esta era a dor do modelo antigo pelo avesso: la, tres freelas viravam
      // tres fontes identicas na aba Fontes. Aqui a aba Fontes nem e tocada.
      for (const mes of ['08', '09', '10']) {
        repo.criarAvulso({
          descricao: 'Freela do cliente X',
          valorCentavos: 100_000,
          dataEsperada: `2026-${mes}-10`
        })
      }

      expect(contarRendas()).toBe(0)
      expect(repo.listar()).toHaveLength(3)
    })

    it('marca como Recebido quando vem data de recebimento', () => {
      const recebimento = repo.criarAvulso({
        descricao: 'Venda',
        valorCentavos: 5_000,
        dataEsperada: '2026-08-10',
        dataRecebida: '2026-08-11'
      })

      expect(recebimento.status).toBe('Recebido')
      expect(recebimento.dataRecebida).toBe('2026-08-11')
    })

    it('recusa valor zero ou negativo', () => {
      expect(() =>
        repo.criarAvulso({ descricao: 'X', valorCentavos: 0, dataEsperada: '2026-08-10' })
      ).toThrow(/valorCentavos/)
    })
  })

  describe('listar — nome resolvido', () => {
    it('avulsa usa a propria descricao; recorrente herda o nome da fonte', () => {
      const fonte = rendas.criarRecorrente({
        nome: 'Bolsa PET',
        valorPadraoCentavos: 90_000,
        diaEsperado: 5,
        dataInicio: '2026-08-01'
      })
      repo.criarAvulso({
        descricao: 'Freela de design',
        valorCentavos: 150_000,
        dataEsperada: '2026-08-10'
      })

      const nomes = repo.listar({ mesReferencia: '2026-08' }).map((r) => r.nome)
      expect(nomes).toContain('Freela de design')
      expect(nomes).toContain('Bolsa PET')
      expect(fonte.recebimentos.length).toBeGreaterThan(0)
    })
  })

  describe('atualizar', () => {
    it('altera descricao, valor e datas da entrada avulsa', () => {
      const criado = repo.criarAvulso({
        descricao: 'Freela',
        valorCentavos: 100_000,
        dataEsperada: '2026-08-10'
      })

      const atualizado = repo.atualizar({
        recebimentoId: criado.id,
        descricao: 'Freela do cliente X',
        valorCentavos: 120_000,
        dataEsperada: '2026-08-15',
        dataRecebida: '2026-08-16'
      })

      expect(atualizado).toMatchObject({
        descricao: 'Freela do cliente X',
        valorCentavos: 120_000,
        dataEsperada: '2026-08-15',
        dataRecebida: '2026-08-16',
        status: 'Recebido'
      })
    })

    it('tirar a data de recebimento volta o status para Esperado', () => {
      const criado = repo.criarAvulso({
        descricao: 'Freela',
        valorCentavos: 100_000,
        dataEsperada: '2026-08-10',
        dataRecebida: '2026-08-11'
      })
      expect(criado.status).toBe('Recebido')

      const atualizado = repo.atualizar({
        recebimentoId: criado.id,
        descricao: 'Freela',
        valorCentavos: 100_000,
        dataEsperada: '2026-08-10'
      })

      expect(atualizado.status).toBe('Esperado')
      expect(atualizado.dataRecebida).toBeNull()
    })

    it('recusa recebimento de fonte recorrente — o reajuste da fonte sobrescreveria', () => {
      const fonte = rendas.criarRecorrente({
        nome: 'Bolsa PET',
        valorPadraoCentavos: 90_000,
        diaEsperado: 5,
        dataInicio: '2026-08-01'
      })
      const doRecorrente = fonte.recebimentos[0]

      expect(() =>
        repo.atualizar({
          recebimentoId: doRecorrente.id,
          descricao: 'tentativa',
          valorCentavos: 1_000,
          dataEsperada: '2026-08-05'
        })
      ).toThrow(/fonte recorrente/i)
    })

    it('recusa id inexistente', () => {
      expect(() =>
        repo.atualizar({
          recebimentoId: 999,
          descricao: 'X',
          valorCentavos: 1_000,
          dataEsperada: '2026-08-05'
        })
      ).toThrow(/nao encontrado/i)
    })
  })

  describe('excluir', () => {
    it('remove a entrada e nao encosta em fonte nenhuma', () => {
      const fonte = rendas.criarRecorrente({
        nome: 'Bolsa PET',
        valorPadraoCentavos: 90_000,
        diaEsperado: 5,
        dataInicio: '2026-08-01'
      })
      const avulso = repo.criarAvulso({
        descricao: 'Freela',
        valorCentavos: 100_000,
        dataEsperada: '2026-08-10'
      })

      repo.excluir(avulso.id)

      expect(repo.findById(avulso.id)).toBeNull()
      expect(rendas.findById(fonte.renda.id)).not.toBeNull()
      expect(contarRendas()).toBe(1)
    })

    it('recusa id inexistente', () => {
      expect(() => repo.excluir(999)).toThrow(/não encontrado/i)
    })
  })
})
