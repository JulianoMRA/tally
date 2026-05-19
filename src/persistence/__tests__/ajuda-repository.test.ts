import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { AjudaRepository } from '../repositories/ajuda-repository'
import { ContribuidorRepository } from '../repositories/contribuidor-repository'
import { DespesaRepository } from '../repositories/despesa-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'

function inserirCartao(db: Database, nome: string, dF = 5, dV = 12): number {
  return db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#000').lastInsertRowid as number
}

function inserirCategoria(db: Database): number {
  return db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Eletrônicos', 'Despesa', '#aaa')")
    .run().lastInsertRowid as number
}

describe('AjudaRepository', () => {
  let db: Database
  let repo: AjudaRepository
  let contribRepo: ContribuidorRepository
  let despesaRepo: DespesaRepository
  let parcelaRepo: ParcelaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new AjudaRepository(db)
    contribRepo = new ContribuidorRepository(db)
    despesaRepo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
  })

  describe('criar — caso simples (não recorrente)', () => {
    it('persiste com status Pendente e recorrente=false', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })

      const r = despesaRepo.criarUnicaCredito({
        descricao: 'Compra',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 10000,
        dataCompra: '2026-06-03'
      })

      const ajudaResult = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcela.id,
        valorCentavos: 5000,
        recorrente: false
      })

      expect(ajudaResult.criadas).toHaveLength(1)
      const a = ajudaResult.criadas[0]
      expect(a.contribuidorId).toBe(mae.id)
      expect(a.parcelaId).toBe(r.parcela.id)
      expect(a.valorCentavos).toBe(5000)
      expect(a.status).toBe('Pendente')
      expect(a.recorrente).toBe(false)
      expect(a.dataRecebimento).toBeNull()
    })

    it('valor inválido lança erro', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r = despesaRepo.criarUnicaCredito({
        descricao: 'X',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })

      expect(() =>
        repo.criar({
          contribuidorId: mae.id,
          parcelaId: r.parcela.id,
          valorCentavos: 0,
          recorrente: false
        })
      ).toThrow()
      expect(() =>
        repo.criar({
          contribuidorId: mae.id,
          parcelaId: r.parcela.id,
          valorCentavos: -10,
          recorrente: false
        })
      ).toThrow()
    })

    it('parcela inexistente lança erro', () => {
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      expect(() =>
        repo.criar({
          contribuidorId: mae.id,
          parcelaId: 9999,
          valorCentavos: 1000,
          recorrente: false
        })
      ).toThrow()
    })
  })

  describe('criar — recorrente (RN-05)', () => {
    it('despesa Única com recorrente=true cria só a ajuda local', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r = despesaRepo.criarUnicaCredito({
        descricao: 'X',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })

      const result = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcela.id,
        valorCentavos: 500,
        recorrente: true
      })

      expect(result.criadas).toHaveLength(1)
      expect(result.criadas[0].recorrente).toBe(true)
    })

    it('despesa Parcelada cria ajuda na parcela origem + parcelas futuras em fatura Aberta', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })

      const r = despesaRepo.criarParceladaCredito({
        descricao: 'Notebook',
        categoriaId: catId,
        cartaoId,
        totalParcelas: 6,
        valorTotalCentavos: 60000,
        dataCompra: '2026-06-03'
      })

      // Origem na 2ª parcela
      const origem = r.parcelas[1]
      const result = repo.criar({
        contribuidorId: mae.id,
        parcelaId: origem.id,
        valorCentavos: 1000,
        recorrente: true
      })

      // Deve criar na origem + nas 4 seguintes (3..6) = 5 ajudas
      expect(result.criadas).toHaveLength(5)
      const parcelasComAjuda = result.criadas.map((a) => a.parcelaId).sort((x, y) => x - y)
      const esperado = [
        r.parcelas[1].id,
        r.parcelas[2].id,
        r.parcelas[3].id,
        r.parcelas[4].id,
        r.parcelas[5].id
      ].sort((x, y) => x - y)
      expect(parcelasComAjuda).toEqual(esperado)
    })

    it('não replica em parcelas com fatura Fechada/Paga', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })

      const r = despesaRepo.criarParceladaCredito({
        descricao: 'TV',
        categoriaId: catId,
        cartaoId,
        totalParcelas: 5,
        valorTotalCentavos: 50000,
        dataCompra: '2026-06-03'
      })

      // Marca 2ª fatura como Fechada e 3ª como Paga
      const fatura2 = r.parcelas[1].faturaId!
      const fatura3 = r.parcelas[2].faturaId!
      db.prepare("UPDATE fatura SET status = 'Fechada' WHERE id = ?").run(fatura2)
      db.prepare(
        "UPDATE fatura SET status = 'Paga', data_pagamento = '2026-07-12' WHERE id = ?"
      ).run(fatura3)

      // Origem na 1ª parcela
      const result = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcelas[0].id,
        valorCentavos: 1000,
        recorrente: true
      })

      // Origem (1) + 4ª + 5ª (faturas Aberta) = 3 ajudas
      expect(result.criadas).toHaveLength(3)
      const parcelasComAjuda = result.criadas.map((a) => a.parcelaId).sort((x, y) => x - y)
      expect(parcelasComAjuda).toEqual(
        [r.parcelas[0].id, r.parcelas[3].id, r.parcelas[4].id].sort((x, y) => x - y)
      )
    })

    it('todas as ajudas replicadas levam recorrente=true', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })

      const r = despesaRepo.criarParceladaCredito({
        descricao: 'TV',
        categoriaId: catId,
        cartaoId,
        totalParcelas: 3,
        valorTotalCentavos: 30000,
        dataCompra: '2026-06-03'
      })

      const result = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcelas[0].id,
        valorCentavos: 500,
        recorrente: true
      })

      for (const a of result.criadas) {
        expect(a.recorrente).toBe(true)
      }
    })
  })

  describe('listarPorParcela', () => {
    it('retorna ajudas só da parcela informada', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r1 = despesaRepo.criarUnicaCredito({
        descricao: 'A',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })
      const r2 = despesaRepo.criarUnicaCredito({
        descricao: 'B',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 2000,
        dataCompra: '2026-06-04'
      })

      repo.criar({
        contribuidorId: mae.id,
        parcelaId: r1.parcela.id,
        valorCentavos: 500,
        recorrente: false
      })
      repo.criar({
        contribuidorId: mae.id,
        parcelaId: r2.parcela.id,
        valorCentavos: 800,
        recorrente: false
      })

      const lista = repo.listarPorParcela(r1.parcela.id)
      expect(lista).toHaveLength(1)
      expect(lista[0].valorCentavos).toBe(500)
    })
  })

  describe('listarPorFatura e totaisPorFatura', () => {
    it('soma ajudas de todas as parcelas da fatura', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const pai = contribRepo.create({ nome: 'Pai', contato: null })
      const r = despesaRepo.criarUnicaCredito({
        descricao: 'X',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 10000,
        dataCompra: '2026-06-03'
      })

      repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcela.id,
        valorCentavos: 3000,
        recorrente: false
      })
      repo.criar({
        contribuidorId: pai.id,
        parcelaId: r.parcela.id,
        valorCentavos: 2000,
        recorrente: false
      })

      const totais = repo.totaisPorFatura(r.fatura.id)
      expect(totais.totalAjudasCentavos).toBe(5000)
      expect(totais.ajudas).toHaveLength(2)
    })
  })

  describe('marcarRecebida', () => {
    it('atualiza status para Recebida e registra data', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r = despesaRepo.criarUnicaCredito({
        descricao: 'X',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })
      const ajuda = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcela.id,
        valorCentavos: 500,
        recorrente: false
      }).criadas[0]

      const atualizada = repo.marcarRecebida(ajuda.id, '2026-06-12')
      expect(atualizada.status).toBe('Recebida')
      expect(atualizada.dataRecebimento).toBe('2026-06-12')
    })
  })

  describe('excluir', () => {
    it('remove ajuda do banco sem afetar outras', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r = despesaRepo.criarParceladaCredito({
        descricao: 'TV',
        categoriaId: catId,
        cartaoId,
        totalParcelas: 3,
        valorTotalCentavos: 3000,
        dataCompra: '2026-06-03'
      })

      const result = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcelas[0].id,
        valorCentavos: 500,
        recorrente: true
      })

      repo.excluir(result.criadas[0].id)
      expect(repo.findById(result.criadas[0].id)).toBeNull()
      // demais réplicas continuam
      expect(repo.findById(result.criadas[1].id)).not.toBeNull()
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.excluir(9999)).toThrow()
    })
  })

  describe('listarAgrupadoPorContribuidor', () => {
    it('agrupa por contribuidor com totais corretos', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const pai = contribRepo.create({ nome: 'Pai', contato: null })

      const r1 = despesaRepo.criarUnicaCredito({
        descricao: 'A',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 10000,
        dataCompra: '2026-06-03'
      })
      const r2 = despesaRepo.criarUnicaCredito({
        descricao: 'B',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 20000,
        dataCompra: '2026-06-04'
      })

      repo.criar({
        contribuidorId: mae.id,
        parcelaId: r1.parcela.id,
        valorCentavos: 5000,
        recorrente: false
      })
      repo.criar({
        contribuidorId: mae.id,
        parcelaId: r2.parcela.id,
        valorCentavos: 8000,
        recorrente: false
      })
      repo.criar({
        contribuidorId: pai.id,
        parcelaId: r2.parcela.id,
        valorCentavos: 3000,
        recorrente: false
      })

      const grupos = repo.listarAgrupadoPorContribuidor()
      expect(grupos).toHaveLength(2)

      const grupoMae = grupos.find((g) => g.contribuidor.id === mae.id)!
      expect(grupoMae.totalCentavos).toBe(13000)
      expect(grupoMae.totalPendentesCentavos).toBe(13000)
      expect(grupoMae.ajudas).toHaveLength(2)
      expect(grupoMae.ajudas[0].descricaoDespesa).toBeTruthy()
      expect(grupoMae.ajudas[0].mesReferencia).toBeTruthy()

      const grupoPai = grupos.find((g) => g.contribuidor.id === pai.id)!
      expect(grupoPai.totalCentavos).toBe(3000)
    })

    it('filtra por status', () => {
      const cartaoId = inserirCartao(db, 'Inter')
      const catId = inserirCategoria(db)
      const mae = contribRepo.create({ nome: 'Mãe', contato: null })
      const r = despesaRepo.criarUnicaCredito({
        descricao: 'X',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })
      const a = repo.criar({
        contribuidorId: mae.id,
        parcelaId: r.parcela.id,
        valorCentavos: 500,
        recorrente: false
      }).criadas[0]
      repo.marcarRecebida(a.id, '2026-06-15')

      const pendentes = repo.listarAgrupadoPorContribuidor({ status: 'Pendente' })
      expect(pendentes).toHaveLength(0)

      const recebidas = repo.listarAgrupadoPorContribuidor({ status: 'Recebida' })
      expect(recebidas).toHaveLength(1)
      expect(recebidas[0].totalPendentesCentavos).toBe(0)
      expect(recebidas[0].totalCentavos).toBe(500)
    })
  })

  it('parcelaRepo.listarPorDespesa continua funcionando após criação de ajudas', () => {
    // Smoke test: integração com parcela-repository
    const cartaoId = inserirCartao(db, 'Inter')
    const catId = inserirCategoria(db)
    const mae = contribRepo.create({ nome: 'Mãe', contato: null })
    const r = despesaRepo.criarParceladaCredito({
      descricao: 'X',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2026-06-03'
    })

    repo.criar({
      contribuidorId: mae.id,
      parcelaId: r.parcelas[0].id,
      valorCentavos: 500,
      recorrente: true
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(3)
  })
})
