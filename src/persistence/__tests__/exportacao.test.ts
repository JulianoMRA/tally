import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { montarLinhasDoMes } from '../exportacao'
import { DespesaRepository } from '../repositories/despesa-repository'
import { RecebimentoRepository } from '../repositories/recebimento-repository'

describe('montarLinhasDoMes (exportação CSV do mês)', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    db.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#f60')`
    )
    db.exec(`INSERT INTO categoria (id, nome, tipo, cor) VALUES (1, 'Mercado', 'Despesa', '#fa0')`)
  })

  it('reúne parcelas de fatura, gastos fora de cartão e recebimentos do mês', () => {
    const despesaRepo = new DespesaRepository(db)
    despesaRepo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId: 1,
      cartaoId: 1,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-02'
    })
    despesaRepo.criarUnicaForaCartao({
      descricao: 'Almoço Pix',
      categoriaId: 1,
      formaPagamento: 'Pix',
      valorCentavos: 2590,
      dataCompra: '2026-06-10'
    })
    new RecebimentoRepository(db).criarAvulsoCompleto({
      nome: 'Freela',
      valorCentavos: 50000,
      dataEsperada: '2026-06-15',
      dataRecebida: '2026-06-15'
    })

    const { header, linhas } = montarLinhasDoMes(db, '2026-06')

    expect(header).toEqual([
      'tipo',
      'descricao',
      'detalhe',
      'categoria',
      'cartao',
      'data',
      'valor',
      'status'
    ])
    expect(linhas).toEqual([
      ['Fatura', 'Notebook', 'parcela 1/3', 'Mercado', 'Inter', '2026-06-01', '100,00', 'Pendente'],
      ['Gasto fora de cartão', 'Almoço Pix', 'Pix', 'Mercado', '', '2026-06-10', '25,90', ''],
      ['Recebimento', 'Freela', '', '', '', '2026-06-15', '500,00', 'Recebido']
    ])
  })

  it('mês sem movimento devolve linhas vazias com o header', () => {
    const { header, linhas } = montarLinhasDoMes(db, '2026-01')
    expect(header).toHaveLength(8)
    expect(linhas).toEqual([])
  })

  it('inclui apenas o mês pedido (parcelas de outros meses ficam fora)', () => {
    new DespesaRepository(db).criarParceladaCredito({
      descricao: 'TV',
      categoriaId: 1,
      cartaoId: 1,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2026-06-02'
    })

    const junho = montarLinhasDoMes(db, '2026-06')
    const julho = montarLinhasDoMes(db, '2026-07')

    expect(junho.linhas).toHaveLength(1)
    expect(junho.linhas[0][2]).toBe('parcela 1/3')
    expect(julho.linhas).toHaveLength(1)
    expect(julho.linhas[0][2]).toBe('parcela 2/3')
  })
})
