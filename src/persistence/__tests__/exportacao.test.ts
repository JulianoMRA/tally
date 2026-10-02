import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { montarLinhasDoMes } from '../exportacao'
import { serializarCsv } from '../../shared/csv/gerar-csv'
import { DespesaRepository } from '../repositories/despesa-repository'
import { PagamentoParcialRepository } from '../repositories/pagamento-parcial-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'
import { RecebimentoRepository } from '../repositories/recebimento-repository'
import { VisaoMensalRepository } from '../repositories/visao-mensal-repository'

describe('montarLinhasDoMes (exportação CSV do mês)', () => {
  let db: Database

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    db.exec(
      `INSERT INTO cartao (id, nome, dia_fechamento, dia_vencimento, cor) VALUES (1, 'Inter', 5, 12, '#f60')`
    )
    db.exec(`INSERT INTO categoria (id, nome, cor) VALUES (1, 'Mercado', '#fa0')`)
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

  /**
   * RN-10 — as linhas "Fatura" somam o que foi comprado, e a sobra do mês conta
   * a fatura pelo que falta pagar. Sem as linhas de pagamento parcial, quem
   * refizesse a conta na planilha não chegaria à sobra que o app mostra.
   */
  describe('pagamento parcial (RF-EXP-01)', () => {
    function faturaDoMes(mes: string): number {
      const row = db.prepare('SELECT id FROM fatura WHERE mes_referencia = ?').get(mes) as {
        id: number
      }
      return row.id
    }

    function parcelarNotebook() {
      new DespesaRepository(db).criarParceladaCredito({
        descricao: 'Notebook',
        categoriaId: 1,
        cartaoId: 1,
        totalParcelas: 3,
        valorTotalCentavos: 30000,
        dataCompra: '2026-06-02'
      })
    }

    it('cada pagamento vira uma linha própria, logo depois das parcelas da fatura', () => {
      parcelarNotebook()
      new DespesaRepository(db).criarUnicaForaCartao({
        descricao: 'Almoço Pix',
        categoriaId: 1,
        formaPagamento: 'Pix',
        valorCentavos: 2590,
        dataCompra: '2026-06-10'
      })
      new PagamentoParcialRepository(db).registrar({
        faturaId: faturaDoMes('2026-06'),
        valorCentavos: 4000,
        dataPagamento: '2026-06-03'
      })

      const { linhas } = montarLinhasDoMes(db, '2026-06')

      expect(linhas).toEqual([
        [
          'Fatura',
          'Notebook',
          'parcela 1/3',
          'Mercado',
          'Inter',
          '2026-06-01',
          '100,00',
          'Pendente'
        ],
        ['Pagamento parcial', 'Fatura de 2026-06', '', '', 'Inter', '2026-06-03', '40,00', ''],
        ['Gasto fora de cartão', 'Almoço Pix', 'Pix', 'Mercado', '', '2026-06-10', '25,90', '']
      ])
    })

    it('vários pagamentos saem em ordem de data', () => {
      parcelarNotebook()
      const repo = new PagamentoParcialRepository(db)
      const faturaId = faturaDoMes('2026-06')
      repo.registrar({ faturaId, valorCentavos: 3000, dataPagamento: '2026-06-04' })
      repo.registrar({ faturaId, valorCentavos: 2000, dataPagamento: '2026-06-02' })

      const pagamentos = montarLinhasDoMes(db, '2026-06').linhas.filter(
        (l) => l[0] === 'Pagamento parcial'
      )

      expect(pagamentos.map((l) => [l[5], l[6]])).toEqual([
        ['2026-06-02', '20,00'],
        ['2026-06-04', '30,00']
      ])
    })

    // O pagamento pertence à fatura, e a fatura é do mês exportado: pagar em
    // maio uma parte da fatura de junho sai no CSV de junho, com a data de maio.
    it('o pagamento segue a fatura, mesmo com data em outro mês', () => {
      parcelarNotebook()
      new PagamentoParcialRepository(db).registrar({
        faturaId: faturaDoMes('2026-06'),
        valorCentavos: 4000,
        dataPagamento: '2026-05-28'
      })

      const junho = montarLinhasDoMes(db, '2026-06').linhas
      const maio = montarLinhasDoMes(db, '2026-05').linhas

      expect(junho.filter((l) => l[0] === 'Pagamento parcial')).toEqual([
        ['Pagamento parcial', 'Fatura de 2026-06', '', '', 'Inter', '2026-05-28', '40,00', '']
      ])
      expect(maio).toEqual([])
    })

    it('pagamento da fatura de outro mês não entra no mês exportado', () => {
      parcelarNotebook()
      new PagamentoParcialRepository(db).registrar({
        faturaId: faturaDoMes('2026-07'),
        valorCentavos: 4000,
        dataPagamento: '2026-06-20'
      })

      const junho = montarLinhasDoMes(db, '2026-06').linhas
      const julho = montarLinhasDoMes(db, '2026-07').linhas

      expect(junho.some((l) => l[0] === 'Pagamento parcial')).toBe(false)
      expect(julho.filter((l) => l[0] === 'Pagamento parcial')).toHaveLength(1)
    })

    it('as linhas de fatura menos as de pagamento parcial dão as saídas do mês', () => {
      parcelarNotebook()
      new PagamentoParcialRepository(db).registrar({
        faturaId: faturaDoMes('2026-06'),
        valorCentavos: 4000,
        dataPagamento: '2026-06-03'
      })

      const { linhas } = montarLinhasDoMes(db, '2026-06')
      const somar = (tipo: string) =>
        linhas
          .filter((l) => l[0] === tipo)
          .reduce((soma, l) => soma + Math.round(Number(l[6].replace(',', '.')) * 100), 0)
      const { totais } = new VisaoMensalRepository(db).detalharSomenteLeitura('2026-06')

      expect(somar('Fatura') - somar('Pagamento parcial')).toBe(totais.totalSaidasCentavos)
    })
  })
})
