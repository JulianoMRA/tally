import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { ParcelaRepository } from '../repositories/parcela-repository'

function inserirCategoria(db: Database): number {
  const info = db.prepare("INSERT INTO categoria (nome, cor) VALUES ('Casa', '#aaa')").run()
  return Number(info.lastInsertRowid)
}

function inserirCartao(db: Database): number {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run('Inter', 5, 12, '#000')
  return Number(info.lastInsertRowid)
}

function inserirFatura(db: Database, cartaoId: number, mes: string): number {
  const info = db
    .prepare(
      "INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status) VALUES (?, ?, ?, ?, 'Aberta')"
    )
    .run(cartaoId, mes, `${mes}-05`, `${mes}-12`)
  return Number(info.lastInsertRowid)
}

/** Recorrente fora de cartão (RF-DES-16): tipo Assinatura, sem cartão. */
function inserirDespesaSemCartao(db: Database, categoriaId: number): number {
  const info = db
    .prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra, dia_cobranca)
       VALUES ('Aluguel', ?, 'Assinatura', 'Pix', NULL, 150000, '2026-09-10', 10)`
    )
    .run(categoriaId)
  return Number(info.lastInsertRowid)
}

function inserirDespesaComCartao(db: Database, categoriaId: number, cartaoId: number): number {
  const info = db
    .prepare(
      `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra)
       VALUES ('Notebook', ?, 'Unica', 'Credito', ?, 50000, '2026-09-03')`
    )
    .run(categoriaId, cartaoId)
  return Number(info.lastInsertRowid)
}

/**
 * RF-DES-21 — marcar e desmarcar ocorrência sem fatura.
 *
 * Até aqui só o pagamento da fatura escrevia `parcela.status`, de modo que uma
 * ocorrência fora de cartão nunca ficava paga — embora as colunas `status` e
 * `data_pagamento` existissem desde a migration 0001.
 */
describe('ParcelaRepository — ocorrência sem fatura', () => {
  let db: Database
  let repo: ParcelaRepository
  let despesaSemCartaoId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new ParcelaRepository(db)
    const catId = inserirCategoria(db)
    despesaSemCartaoId = inserirDespesaSemCartao(db, catId)
  })

  function criarOcorrencia(numero = 1): number {
    return repo.criar({
      despesaId: despesaSemCartaoId,
      faturaId: null,
      numero,
      total: null,
      valorCentavos: 150000,
      dataReferencia: '2026-09-10'
    }).id
  }

  describe('marcarPaga', () => {
    it('grava status e data de pagamento', () => {
      const id = criarOcorrencia()

      const parcela = repo.marcarPaga(id, '2026-09-11')

      expect(parcela.status).toBe('Paga')
      expect(parcela.dataPagamento).toBe('2026-09-11')
    })

    it('recusa ocorrência que pertence a uma fatura', () => {
      const catId = inserirCategoria(db)
      const cartaoId = inserirCartao(db)
      const faturaId = inserirFatura(db, cartaoId, '2026-09')
      const despesaId = inserirDespesaComCartao(db, catId, cartaoId)
      const comFatura = repo.criar({
        despesaId,
        faturaId,
        numero: 1,
        total: 1,
        valorCentavos: 50000,
        dataReferencia: '2026-09-01'
      })

      expect(() => repo.marcarPaga(comFatura.id, '2026-09-11')).toThrow(/fatura/i)
    })

    it('recusa ocorrência já paga', () => {
      const id = criarOcorrencia()
      repo.marcarPaga(id, '2026-09-11')

      expect(() => repo.marcarPaga(id, '2026-09-12')).toThrow(/já está paga/i)
    })

    it('recusa parcela inexistente', () => {
      expect(() => repo.marcarPaga(9999, '2026-09-11')).toThrow(/não encontrada/i)
    })
  })

  describe('desmarcarPaga', () => {
    it('volta para Pendente e limpa a data de pagamento', () => {
      const id = criarOcorrencia()
      repo.marcarPaga(id, '2026-09-11')

      const parcela = repo.desmarcarPaga(id)

      expect(parcela.status).toBe('Pendente')
      expect(parcela.dataPagamento).toBeNull()
    })

    it('recusa ocorrência que já está pendente', () => {
      const id = criarOcorrencia()

      expect(() => repo.desmarcarPaga(id)).toThrow(/já está pendente/i)
    })
  })

  /**
   * O ponto da escotilha: marcar bloqueia excluir (RF-DES-09) e editar
   * (RF-DES-10) a despesa inteira, porque as duas regras leem
   * `parcela.status`. Sem desmarcar, pagar setembro travaria "Aluguel" para
   * sempre. Este teste prova que a volta é completa — não sobra resíduo.
   */
  it('marcar e desmarcar devolve a ocorrência ao estado exato de origem', () => {
    const id = criarOcorrencia()
    const antes = db.prepare('SELECT status, data_pagamento FROM parcela WHERE id = ?').get(id)

    repo.marcarPaga(id, '2026-09-11')
    repo.desmarcarPaga(id)

    const depois = db.prepare('SELECT status, data_pagamento FROM parcela WHERE id = ?').get(id)
    expect(depois).toEqual(antes)
  })

  it('não toca nas outras ocorrências da mesma despesa', () => {
    const setembro = criarOcorrencia(1)
    const outubro = criarOcorrencia(2)

    repo.marcarPaga(setembro, '2026-09-11')

    const outro = db.prepare('SELECT status FROM parcela WHERE id = ?').get(outubro) as {
      status: string
    }
    expect(outro.status).toBe('Pendente')
  })
})
