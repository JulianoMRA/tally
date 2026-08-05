import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { FaturaRepository } from '../repositories/fatura-repository'

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
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES (?, 'Despesa', '#5b7a5e')")
    .run(nome)
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
