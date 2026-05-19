import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { VisaoMensalRepository } from '../repositories/visao-mensal-repository'
import { DespesaRepository } from '../repositories/despesa-repository'
import { AjudaRepository } from '../repositories/ajuda-repository'
import { ContribuidorRepository } from '../repositories/contribuidor-repository'
import { RendaRepository } from '../repositories/renda-repository'
import { RecebimentoRepository } from '../repositories/recebimento-repository'

function inserirCartao(db: Database, nome: string, dF = 5, dV = 12): number {
  return db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#abc').lastInsertRowid as number
}

function inserirCategoria(db: Database, nome = 'Geral', tipo = 'Despesa'): number {
  return db
    .prepare('INSERT INTO categoria (nome, tipo, cor) VALUES (?, ?, ?)')
    .run(nome, tipo, '#000').lastInsertRowid as number
}

describe('VisaoMensalRepository.detalhar (RF-VIS-01/02 + RN-08)', () => {
  let db: Database
  let repo: VisaoMensalRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new VisaoMensalRepository(db)
  })

  it('mês sem dados retorna estrutura vazia com totais zerados', () => {
    const result = repo.detalhar('2026-06')
    expect(result.mesReferencia).toBe('2026-06')
    expect(result.faturas).toEqual([])
    expect(result.gastosForaCartao).toEqual([])
    expect(result.recebimentos).toEqual([])
    expect(result.ajudasPendentes).toEqual([])
    expect(result.totais.saldoRealizadoCentavos).toBe(0)
    expect(result.totais.saldoProjetadoCentavos).toBe(0)
  })

  it('consolida faturas + gastos fora cartão + recebimentos do mês', () => {
    const cartaoInter = inserirCartao(db, 'Inter', 5, 12)
    const cartaoNubank = inserirCartao(db, 'Nubank', 15, 22)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)
    const rendaRepo = new RendaRepository(db)

    despesaRepo.criarUnicaCredito({
      descricao: 'Compra Inter',
      categoriaId: catId,
      cartaoId: cartaoInter,
      valorCentavos: 10000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaCredito({
      descricao: 'Compra Nubank',
      categoriaId: catId,
      cartaoId: cartaoNubank,
      valorCentavos: 5000,
      dataCompra: '2026-06-10'
    })
    despesaRepo.criarUnicaForaCartao({
      descricao: 'Pix mercado',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorCentavos: 3000,
      dataCompra: '2026-06-15'
    })
    rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 100000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })

    const result = repo.detalhar('2026-06')

    expect(result.faturas).toHaveLength(2)
    const nomesFaturas = result.faturas.map((f) => f.cartaoNome).sort()
    expect(nomesFaturas).toEqual(['Inter', 'Nubank'])

    expect(result.gastosForaCartao).toHaveLength(1)
    expect(result.recebimentos).toHaveLength(1)

    // RN-08: saldo = recebido - (faturas líquido + gastos)
    // recebido = 0 (recém criado, status Esperado), esperado = 100000
    // saídas = 10000 + 5000 + 3000 = 18000
    expect(result.totais.totalSaidasLiquidasCentavos).toBe(18000)
    expect(result.totais.totalEntradasRecebidasCentavos).toBe(0)
    expect(result.totais.totalEntradasProjetadasCentavos).toBe(100000)
    expect(result.totais.saldoRealizadoCentavos).toBe(-18000)
    expect(result.totais.saldoProjetadoCentavos).toBe(82000)
  })

  it('líquido da fatura desconta ajudas (RN-07)', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)
    const contribRepo = new ContribuidorRepository(db)
    const ajudaRepo = new AjudaRepository(db)

    const r = despesaRepo.criarUnicaCredito({
      descricao: 'X',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 10000,
      dataCompra: '2026-06-03'
    })
    const mae = contribRepo.create({ nome: 'Mãe', contato: null })
    ajudaRepo.criar({
      contribuidorId: mae.id,
      parcelaId: r.parcela.id,
      valorCentavos: 3000,
      recorrente: false
    })

    const result = repo.detalhar('2026-06')
    expect(result.faturas[0].totalBrutoCentavos).toBe(10000)
    expect(result.faturas[0].totalAjudasCentavos).toBe(3000)
    expect(result.faturas[0].totalLiquidoCentavos).toBe(7000)
    expect(result.totais.totalSaidasLiquidasCentavos).toBe(7000)
  })

  it('ajudas Pendentes aparecem agrupadas por contribuidor; Recebidas excluídas', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)
    const contribRepo = new ContribuidorRepository(db)
    const ajudaRepo = new AjudaRepository(db)

    const r = despesaRepo.criarUnicaCredito({
      descricao: 'X',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 10000,
      dataCompra: '2026-06-03'
    })
    const mae = contribRepo.create({ nome: 'Mãe', contato: null })
    const pai = contribRepo.create({ nome: 'Pai', contato: null })

    ajudaRepo.criar({
      contribuidorId: mae.id,
      parcelaId: r.parcela.id,
      valorCentavos: 3000,
      recorrente: false
    })
    const ajudaPai = ajudaRepo.criar({
      contribuidorId: pai.id,
      parcelaId: r.parcela.id,
      valorCentavos: 2000,
      recorrente: false
    })
    // Marca a ajuda do pai como Recebida — não deve aparecer em pendentes
    ajudaRepo.marcarRecebida(ajudaPai.criadas[0].id, '2026-06-10')

    const result = repo.detalhar('2026-06')
    expect(result.ajudasPendentes).toHaveLength(1)
    expect(result.ajudasPendentes[0].contribuidorNome).toBe('Mãe')
    expect(result.ajudasPendentes[0].totalPendenteCentavos).toBe(3000)
  })

  it('exclui faturas e dados de outros meses', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)

    despesaRepo.criarUnicaCredito({
      descricao: 'Junho',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    despesaRepo.criarUnicaCredito({
      descricao: 'Julho',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2000,
      dataCompra: '2026-06-10' // dia 10 > F=5 → fatura julho
    })

    const junho = repo.detalhar('2026-06')
    expect(junho.faturas).toHaveLength(1)
    expect(junho.totais.totalSaidasLiquidasCentavos).toBe(1000)

    const julho = repo.detalhar('2026-07')
    expect(julho.faturas).toHaveLength(1)
    expect(julho.totais.totalSaidasLiquidasCentavos).toBe(2000)
  })

  it('contabiliza recebido vs esperado corretamente', () => {
    const rendaRepo = new RendaRepository(db)
    const recebimentoRepo = new RecebimentoRepository(db)

    const r = rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 100000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })
    // Marca o primeiro como Recebido
    recebimentoRepo.marcarRecebido(r.recebimentos[0].id, '2026-06-05')

    const result = repo.detalhar('2026-06')
    expect(result.totais.totalEntradasRecebidasCentavos).toBe(100000)
    expect(result.totais.totalEntradasProjetadasCentavos).toBe(100000)
    expect(result.totais.saldoRealizadoCentavos).toBe(100000)
  })
})
