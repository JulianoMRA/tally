import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'

function inserirCartao(db: Database, nome: string, dF: number, dV: number): number {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#000')
  return Number(info.lastInsertRowid)
}

function inserirCategoria(db: Database): number {
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Casa', 'Despesa', '#aaa')")
    .run()
  return Number(info.lastInsertRowid)
}

describe('DespesaRepository.listarOcorrenciasDoMes', () => {
  let db: Database
  let repo: DespesaRepository
  let cartaoId: number
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    // Fecha dia 5, vence dia 12: compra em 03/06 cai na fatura de junho.
    cartaoId = inserirCartao(db, 'Inter', 5, 12)
    categoriaId = inserirCategoria(db)
  })

  it('devolve uma linha por parcela do mês, não uma por despesa', () => {
    repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-03'
    })

    expect(repo.listarOcorrenciasDoMes('2026-06')).toHaveLength(1)
    expect(repo.listarOcorrenciasDoMes('2026-07')).toHaveLength(1)
    expect(repo.listarOcorrenciasDoMes('2026-08')).toHaveLength(1)
    expect(repo.listarOcorrenciasDoMes('2026-09')).toEqual([])
  })

  it('traz o valor da parcela, não o total da compra', () => {
    repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-03'
    })

    const [ocorrencia] = repo.listarOcorrenciasDoMes('2026-06')
    expect(ocorrencia?.parcela_valor_centavos).toBe(10000)
    expect(ocorrencia?.despesa_valor_centavos).toBe(30000)
  })

  // O resto dos centavos vai na ÚLTIMA parcela (distribuirCentavos), então o
  // mês final tem que trazer o centavo a mais, não a média.
  it('preserva o centavo de resto na última parcela', () => {
    repo.criarParceladaCredito({
      descricao: 'Livro',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 10000,
      dataCompra: '2026-06-03'
    })

    expect(repo.listarOcorrenciasDoMes('2026-06')[0]?.parcela_valor_centavos).toBe(3333)
    expect(repo.listarOcorrenciasDoMes('2026-08')[0]?.parcela_valor_centavos).toBe(3334)
  })

  // É o dado que separa "parcelada do zero" de "em andamento": sem ele, o
  // saldo devedor seria exibido como preço de compra.
  it('marca menor_numero como 1 para parcelada criada do zero', () => {
    repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-03'
    })

    expect(repo.listarOcorrenciasDoMes('2026-06')[0]?.menor_numero).toBe(1)
  })

  it('marca menor_numero com a parcela inicial de uma parcelada em andamento', () => {
    repo.criarParceladaEmAndamento({
      descricao: 'Notebook usado',
      categoriaId,
      cartaoId,
      totalParcelas: 12,
      parcelaAtual: 7,
      valorRestanteCentavos: 300000,
      dataCompra: '2026-06-03'
    })

    const [ocorrencia] = repo.listarOcorrenciasDoMes('2026-06')
    expect(ocorrencia?.menor_numero).toBe(7)
    expect(ocorrencia?.numero).toBe(7)
    // 300000 restantes em 6 parcelas (7..12), não em 12.
    expect(ocorrencia?.parcela_valor_centavos).toBe(50000)
  })

  it('inclui gasto fora do cartão pelo mês da data de compra', () => {
    repo.criarUnicaForaCartao({
      descricao: 'Feira',
      categoriaId,
      formaPagamento: 'Pix',
      valorCentavos: 8500,
      dataCompra: '2026-06-20'
    })

    const [ocorrencia] = repo.listarOcorrenciasDoMes('2026-06')
    expect(ocorrencia?.descricao).toBe('Feira')
    expect(ocorrencia?.cartao_id).toBeNull()
    expect(ocorrencia?.forma_pagamento).toBe('Pix')
    expect(ocorrencia?.parcela_valor_centavos).toBe(8500)
  })

  // Compra depois do fechamento cai na fatura seguinte (RN-01): a ocorrência
  // tem que seguir a fatura, não a data da compra.
  it('coloca compra de crédito no mês da fatura, não no da compra', () => {
    repo.criarUnicaCredito({
      descricao: 'Compra após fechamento',
      categoriaId,
      cartaoId,
      valorCentavos: 5000,
      dataCompra: '2026-06-28'
    })

    expect(repo.listarOcorrenciasDoMes('2026-06')).toEqual([])
    expect(repo.listarOcorrenciasDoMes('2026-07')).toHaveLength(1)
  })

  it('inclui a ocorrência mensal de uma assinatura', () => {
    repo.criarAssinaturaCredito({
      descricao: 'Streaming',
      categoriaId,
      cartaoId,
      valorMensalCentavos: 4490,
      dataInicio: '2026-06-01'
    })

    const [ocorrencia] = repo.listarOcorrenciasDoMes('2026-07')
    expect(ocorrencia?.descricao).toBe('Streaming')
    expect(ocorrencia?.tipo).toBe('Assinatura')
    expect(ocorrencia?.parcela_valor_centavos).toBe(4490)
    expect(ocorrencia?.total).toBeNull()
  })

  it('devolve lista vazia para mês sem movimento', () => {
    expect(repo.listarOcorrenciasDoMes('2030-01')).toEqual([])
  })
})
