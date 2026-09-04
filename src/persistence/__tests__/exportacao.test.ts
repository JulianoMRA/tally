import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { montarLinhasDoMes } from '../exportacao'
import { serializarCsv } from '../../shared/csv/gerar-csv'
import { DespesaRepository } from '../repositories/despesa-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'
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
    new RecebimentoRepository(db).criarAvulso({
      descricao: 'Freela',
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

  it('descricao que a planilha executaria sai neutralizada do serializador', () => {
    // Caminho completo do vetor: a descricao chega ao banco como texto (digitada
    // ou vinda de um CSV de terceiro pela importacao), atravessa o export e so
    // e' neutralizada na serializacao. A linha crua segue com o texto original —
    // o dado do usuario nao e' alterado no banco nem na leitura.
    new DespesaRepository(db).criarUnicaForaCartao({
      descricao: "=cmd|'/c calc'!A1",
      categoriaId: 1,
      formaPagamento: 'Pix',
      valorCentavos: 1000,
      dataCompra: '2026-06-10'
    })

    const { header, linhas } = montarLinhasDoMes(db, '2026-06')
    expect(linhas[0][1]).toBe("=cmd|'/c calc'!A1")

    const csv = serializarCsv(header, linhas)
    expect(csv).toContain("'=cmd|")
    expect(csv).not.toContain(';=cmd|')
    // e a coluna de valor sobrevive numerica
    expect(csv).toContain(';10,00;')
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

  /**
   * O sintoma visível de o adiantamento não mover `data_referencia` junto com
   * `fatura_id`: a exportação lê as parcelas PELA FATURA do mês, mas imprime
   * `parcela.data_referencia` na coluna `data`. Com a coluna presa no mês
   * antigo, o CSV de junho saía com linhas datadas de agosto.
   */
  it('data das parcelas adiantadas cai no mês exportado', () => {
    const { despesa } = new DespesaRepository(db).criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId: 1,
      cartaoId: 1,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-02'
    })

    const destino = db.prepare("SELECT id FROM fatura WHERE mes_referencia = '2026-06'").get() as {
      id: number
    }
    new ParcelaRepository(db).adiantar({
      despesaId: despesa.id,
      quantidade: 2,
      faturaDestinoId: destino.id
    })

    const { linhas } = montarLinhasDoMes(db, '2026-06')

    expect(linhas).toHaveLength(3)
    const datas = linhas.filter((l) => l[0] === 'Fatura').map((l) => l[5])
    expect(datas).toEqual(['2026-06-01', '2026-06-01', '2026-06-01'])
  })
})
