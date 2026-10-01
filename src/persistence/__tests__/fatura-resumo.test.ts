import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { FaturaRepository } from '../repositories/fatura-repository'
import { PagamentoParcialRepository } from '../repositories/pagamento-parcial-repository'

/**
 * A tela de Faturas listava mês, fechamento, vencimento e status de 13+ faturas
 * por cartão — sem o total, que é a informação número um. O total só existia em
 * `detalharComParcelas`, uma chamada por fatura: usá-lo na lista seria um N+1.
 *
 * `listarResumoPorCartao` resolve com uma única query agregada.
 */
function inserirCartao(db: Database, nome: string, fechamento: number, vencimento: number) {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, fechamento, vencimento, '#5a4a8a')
  return { id: Number(info.lastInsertRowid), diaFechamento: fechamento, diaVencimento: vencimento }
}

function inserirCategoria(db: Database, nome: string): number {
  const info = db.prepare("INSERT INTO categoria (nome, cor) VALUES (?, '#5b7a5e')").run(nome)
  return Number(info.lastInsertRowid)
}

describe('FaturaRepository.listarResumoPorCartao', () => {
  let db: Database
  let repo: FaturaRepository
  let despesas: DespesaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
    despesas = new DespesaRepository(db)
  })

  it('devolve lista vazia para cartão sem fatura', () => {
    const cartao = inserirCartao(db, 'Inter', 5, 12)

    expect(repo.listarResumoPorCartao(cartao.id)).toEqual([])
  })

  it('soma as parcelas de cada fatura numa única passada', () => {
    const cartao = inserirCartao(db, 'Inter', 5, 12)
    const categoria = inserirCategoria(db, 'Mercado')

    // Duas compras na MESMA fatura (2026-07) e uma na seguinte.
    despesas.criarUnicaCredito({
      descricao: 'Compra A',
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos: 10_000,
      dataCompra: '2026-06-07'
    })
    despesas.criarUnicaCredito({
      descricao: 'Compra B',
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos: 25_050,
      dataCompra: '2026-06-20'
    })
    despesas.criarUnicaCredito({
      descricao: 'Compra C',
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos: 7_000,
      dataCompra: '2026-07-10'
    })

    const resumo = repo.listarResumoPorCartao(cartao.id)

    expect(resumo).toHaveLength(2)
    expect(resumo[0]).toMatchObject({ mesReferencia: '2026-07', totalCentavos: 35_050 })
    expect(resumo[1]).toMatchObject({ mesReferencia: '2026-08', totalCentavos: 7_000 })
  })

  it('devolve total zero para fatura sem parcelas, em vez de omiti-la', () => {
    const cartao = inserirCartao(db, 'Inter', 5, 12)
    const categoria = inserirCategoria(db, 'Mercado')

    despesas.criarUnicaCredito({
      descricao: 'Compra',
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos: 10_000,
      dataCompra: '2026-06-07'
    })
    // Fatura criada direto, sem parcela: o LEFT JOIN precisa preservá-la.
    repo.upsertParaCompra(cartao, '2026-08-07')

    const resumo = repo.listarResumoPorCartao(cartao.id)

    expect(resumo).toHaveLength(2)
    expect(resumo[1]).toMatchObject({ mesReferencia: '2026-09', totalCentavos: 0 })
  })

  it('não mistura faturas de outros cartões', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const nubank = inserirCartao(db, 'Nubank', 3, 10)
    const categoria = inserirCategoria(db, 'Mercado')

    despesas.criarUnicaCredito({
      descricao: 'No Inter',
      categoriaId: categoria,
      cartaoId: inter.id,
      valorCentavos: 10_000,
      dataCompra: '2026-06-07'
    })
    despesas.criarUnicaCredito({
      descricao: 'No Nubank',
      categoriaId: categoria,
      cartaoId: nubank.id,
      valorCentavos: 99_000,
      dataCompra: '2026-06-07'
    })

    const resumo = repo.listarResumoPorCartao(inter.id)

    expect(resumo).toHaveLength(1)
    expect(resumo[0].totalCentavos).toBe(10_000)
  })

  it('preserva o status e as datas da fatura junto do total', () => {
    const cartao = inserirCartao(db, 'Inter', 5, 12)
    const categoria = inserirCategoria(db, 'Mercado')
    despesas.criarUnicaCredito({
      descricao: 'Compra',
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos: 10_000,
      dataCompra: '2026-06-07'
    })

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha.fatura).toMatchObject({
      cartaoId: cartao.id,
      mesReferencia: '2026-07',
      dataFechamento: '2026-07-05',
      dataVencimento: '2026-07-12'
    })
    expect(linha.fatura.status.kind).toBe('Aberta')
  })

  it('ordena por mês de referência, do mais antigo ao mais novo', () => {
    const cartao = inserirCartao(db, 'Inter', 5, 12)
    const categoria = inserirCategoria(db, 'Mercado')

    for (const data of ['2026-09-07', '2026-06-07', '2026-07-20']) {
      despesas.criarUnicaCredito({
        descricao: `Compra ${data}`,
        categoriaId: categoria,
        cartaoId: cartao.id,
        valorCentavos: 1_000,
        dataCompra: data
      })
    }

    const meses = repo.listarResumoPorCartao(cartao.id).map((l) => l.mesReferencia)

    expect(meses).toEqual(['2026-07', '2026-08', '2026-10'])
  })
})

/**
 * RN-10 — o resumo traz, além do total, o que já foi pago em parciais e o que
 * falta pagar. É o que o trilho e o histórico mostram: sem isso a fatura
 * seguiria exibindo o total depois de um pagamento parcial.
 */
describe('FaturaRepository.listarResumoPorCartao — pagamento parcial (RN-10)', () => {
  let db: Database
  let repo: FaturaRepository
  let despesas: DespesaRepository
  let pagamentos: PagamentoParcialRepository
  let cartao: ReturnType<typeof inserirCartao>
  let categoria: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
    despesas = new DespesaRepository(db)
    pagamentos = new PagamentoParcialRepository(db)
    cartao = inserirCartao(db, 'Inter', 5, 12)
    categoria = inserirCategoria(db, 'Mercado')
  })

  function comprar(valorCentavos: number, dataCompra: string) {
    return despesas.criarUnicaCredito({
      descricao: `Compra de ${valorCentavos}`,
      categoriaId: categoria,
      cartaoId: cartao.id,
      valorCentavos,
      dataCompra
    })
  }

  it('sem pagamento parcial, o pago é zero e falta pagar o total', () => {
    comprar(80_000, '2026-06-07')

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({
      totalCentavos: 80_000,
      pagoParcialCentavos: 0,
      restanteCentavos: 80_000
    })
  })

  it('desconta os pagamentos parciais do que falta pagar, sem mexer no total', () => {
    const { fatura } = comprar(80_000, '2026-06-07')
    pagamentos.registrar({
      faturaId: fatura.id,
      valorCentavos: 20_000,
      dataPagamento: '2026-06-20'
    })

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({
      totalCentavos: 80_000,
      pagoParcialCentavos: 20_000,
      restanteCentavos: 60_000
    })
  })

  // O total vinha de um LEFT JOIN com `parcela`. Um segundo JOIN com os
  // pagamentos faria o produto das duas tabelas: 2 parcelas x 2 pagamentos
  // dobraria o total E o pago, e a conta fecharia errada sem erro nenhum.
  it('duas parcelas e dois pagamentos não se multiplicam', () => {
    const { fatura } = comprar(50_000, '2026-06-07')
    comprar(30_000, '2026-06-08')
    pagamentos.registrar({
      faturaId: fatura.id,
      valorCentavos: 10_000,
      dataPagamento: '2026-06-20'
    })
    pagamentos.registrar({
      faturaId: fatura.id,
      valorCentavos: 15_000,
      dataPagamento: '2026-06-25'
    })

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({
      totalCentavos: 80_000,
      pagoParcialCentavos: 25_000,
      restanteCentavos: 55_000
    })
  })

  it('o pagamento de uma fatura não desconta das outras do cartão', () => {
    const julho = comprar(80_000, '2026-06-07').fatura
    comprar(40_000, '2026-07-10')
    pagamentos.registrar({ faturaId: julho.id, valorCentavos: 20_000, dataPagamento: '2026-06-20' })

    const resumo = repo.listarResumoPorCartao(cartao.id)

    expect(resumo[0]).toMatchObject({ mesReferencia: '2026-07', restanteCentavos: 60_000 })
    expect(resumo[1]).toMatchObject({
      mesReferencia: '2026-08',
      pagoParcialCentavos: 0,
      restanteCentavos: 40_000
    })
  })

  it('não mistura os pagamentos de outro cartão', () => {
    const nubank = inserirCartao(db, 'Nubank', 3, 10)
    comprar(80_000, '2026-06-07')
    const doNubank = despesas.criarUnicaCredito({
      descricao: 'No Nubank',
      categoriaId: categoria,
      cartaoId: nubank.id,
      valorCentavos: 50_000,
      dataCompra: '2026-06-07'
    }).fatura
    pagamentos.registrar({
      faturaId: doNubank.id,
      valorCentavos: 10_000,
      dataPagamento: '2026-06-20'
    })

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({ pagoParcialCentavos: 0, restanteCentavos: 80_000 })
  })

  // A despesa foi excluída depois do pagamento (fatura Aberta deixa). O
  // restante não pode ficar negativo: zera, e o pago continua dizendo a verdade.
  it('pago a mais zera o que falta pagar em vez de ficar negativo', () => {
    const { fatura, despesa } = comprar(80_000, '2026-06-07')
    comprar(10_000, '2026-06-08')
    pagamentos.registrar({
      faturaId: fatura.id,
      valorCentavos: 50_000,
      dataPagamento: '2026-06-20'
    })
    despesas.excluir(despesa.id)

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({
      totalCentavos: 10_000,
      pagoParcialCentavos: 50_000,
      restanteCentavos: 0
    })
  })

  it('fatura sem parcela e sem pagamento continua na lista, zerada', () => {
    repo.upsertParaCompra(cartao, '2026-08-07')

    const [linha] = repo.listarResumoPorCartao(cartao.id)

    expect(linha).toMatchObject({
      totalCentavos: 0,
      pagoParcialCentavos: 0,
      restanteCentavos: 0
    })
  })
})
