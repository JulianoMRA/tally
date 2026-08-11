import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { VisaoMensalRepository } from '../repositories/visao-mensal-repository'
import { DespesaRepository } from '../repositories/despesa-repository'
import { RendaRepository } from '../repositories/renda-repository'
import { RecebimentoRepository } from '../repositories/recebimento-repository'

function inserirCartao(db: Database, nome: string, dF = 5, dV = 12): number {
  return db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#abc').lastInsertRowid as number
}

function arquivarCartao(db: Database, id: number): void {
  db.prepare('UPDATE cartao SET ativo = 0 WHERE id = ?').run(id)
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
    expect(result.totais.saldoRealizadoCentavos).toBe(0)
    expect(result.totais.saldoProjetadoCentavos).toBe(0)
  })

  it('RN-06: detalhar fecha faturas Abertas vencidas sem exigir reinício do app', () => {
    const cartaoId = inserirCartao(db, 'Inter')
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, '2000-01', '2000-01-05', '2000-01-12', 'Aberta')`
    ).run(cartaoId)

    const result = repo.detalhar('2000-01')

    expect(result.faturas).toHaveLength(1)
    expect(result.faturas[0].fatura.status).toEqual({ kind: 'Fechada' })
  })

  it('RN-06: fatura com fechamento futuro permanece Aberta após detalhar', () => {
    const cartaoId = inserirCartao(db, 'Inter')
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, '2999-01', '2999-01-05', '2999-01-12', 'Aberta')`
    ).run(cartaoId)

    const result = repo.detalhar('2999-01')

    expect(result.faturas).toHaveLength(1)
    expect(result.faturas[0].fatura.status).toEqual({ kind: 'Aberta' })
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
    expect(result.totais.totalSaidasCentavos).toBe(18000)
    expect(result.totais.totalEntradasRecebidasCentavos).toBe(0)
    expect(result.totais.totalEntradasProjetadasCentavos).toBe(100000)
    expect(result.totais.saldoRealizadoCentavos).toBe(-18000)
    expect(result.totais.saldoProjetadoCentavos).toBe(82000)
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
    expect(junho.totais.totalSaidasCentavos).toBe(1000)

    const julho = repo.detalhar('2026-07')
    expect(julho.faturas).toHaveLength(1)
    expect(julho.totais.totalSaidasCentavos).toBe(2000)
  })

  it('omite fatura sem parcelas de cartão arquivado', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')`
    ).run(cartaoId)
    arquivarCartao(db, cartaoId)

    const result = repo.detalhar('2026-06')

    expect(result.faturas).toEqual([])
  })

  it('RF-CAR-02: mantém fatura com parcelas de cartão arquivado (histórico permanece visível)', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    new DespesaRepository(db).criarUnicaCredito({
      descricao: 'Compra antes de arquivar',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 7000,
      dataCompra: '2026-06-03'
    })
    arquivarCartao(db, cartaoId)

    const result = repo.detalhar('2026-06')

    expect(result.faturas).toHaveLength(1)
    expect(result.faturas[0].cartaoNome).toBe('Inter')
    expect(result.totais.totalSaidasCentavos).toBe(7000)
  })

  it('mantém fatura sem parcelas de cartão ativo', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, '2026-06', '2026-06-05', '2026-06-12', 'Aberta')`
    ).run(cartaoId)

    const result = repo.detalhar('2026-06')

    expect(result.faturas).toHaveLength(1)
    expect(result.faturas[0].totalCentavos).toBe(0)
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

describe('VisaoMensalRepository.detalhar — extensão de horizonte (RF-VIS-04, RN-04)', () => {
  let db: Database
  let repo: VisaoMensalRepository

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'))
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new VisaoMensalRepository(db)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mês passado/presente: não estende, nem afeta dados', () => {
    const rendaRepo = new RendaRepository(db)
    const r = rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 100000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })

    repo.detalhar('2026-05') // mês atual

    const total = db
      .prepare('SELECT COUNT(*) as n FROM recebimento WHERE renda_id = ?')
      .get(r.renda.id) as { n: number }
    expect(total.n).toBe(12)
  })

  it('mês futuro além do horizonte: gera parcelas e recebimentos faltantes', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)
    const rendaRepo = new RendaRepository(db)

    despesaRepo.criarAssinaturaCredito({
      descricao: 'Spotify',
      categoriaId: catId,
      cartaoId,
      valorMensalCentavos: 2000,
      dataInicio: '2026-06-03'
    })
    rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 100000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })

    // hoje=2026-05; alvo=2027-08 → 15 meses adiante (dentro do cap de 24).
    // horizonte inicial da assinatura: 2026-06..2027-05.
    const result = repo.detalhar('2027-08')

    expect(result.faturas).toHaveLength(1)
    expect(result.faturas[0].totalCentavos).toBe(2000)

    expect(result.recebimentos).toHaveLength(1)
    expect(result.recebimentos[0].valorCentavos).toBe(100000)
    expect(result.recebimentos[0].status).toBe('Esperado')

    expect(result.totais.totalEntradasProjetadasCentavos).toBe(100000)
    expect(result.totais.totalEntradasRecebidasCentavos).toBe(0)
  })

  it('respeita o cap de 24 meses adiante de hoje: além disso não estende', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)

    despesaRepo.criarAssinaturaCredito({
      descricao: 'Spotify',
      categoriaId: catId,
      cartaoId,
      valorMensalCentavos: 2000,
      dataInicio: '2026-06-03'
    })

    // hoje=2026-05; alvo=2029-01 → 32 meses adiante, acima do cap (24)
    const result = repo.detalhar('2029-01')

    expect(result.faturas).toEqual([])
    expect(result.recebimentos).toEqual([])
  })

  it('idempotente: detalhar duas vezes para o mesmo mês futuro não duplica', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)
    const despesaRepo = new DespesaRepository(db)
    const rendaRepo = new RendaRepository(db)

    despesaRepo.criarAssinaturaCredito({
      descricao: 'Spotify',
      categoriaId: catId,
      cartaoId,
      valorMensalCentavos: 2000,
      dataInicio: '2026-06-03'
    })
    rendaRepo.criarRecorrente({
      nome: 'Bolsa',
      valorPadraoCentavos: 100000,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    })

    repo.detalhar('2027-09')
    repo.detalhar('2027-09')

    const parcelas = db
      .prepare("SELECT COUNT(*) AS n FROM parcela WHERE data_referencia LIKE '2027-09%'")
      .get() as { n: number }
    const recebimentos = db
      .prepare(
        "SELECT COUNT(*) AS n FROM recebimento WHERE substr(data_esperada, 1, 7) = '2027-09'"
      )
      .get() as { n: number }

    expect(parcelas.n).toBe(1)
    expect(recebimentos.n).toBe(1)
  })
})

describe('VisaoMensalRepository — cartão que vence no mês seguinte ao fechamento', () => {
  let db: Database
  let repo: VisaoMensalRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new VisaoMensalRepository(db)
  })

  /**
   * Cartão F=24/V=01: o ciclo fecha 24/08 e é pago em 01/09. O mês de
   * referência continua sendo o do fechamento (agosto) — decisão de produto:
   * a fatura é agrupada pelo ciclo que a originou, não pela data em que sai o
   * dinheiro. O que mudou é só o vencimento exibido, que antes caía em 01/08.
   */
  it('agrupa a compra no mês do fechamento, exibindo o vencimento do mês seguinte', () => {
    const cartaoId = inserirCartao(db, 'Fecha24Vence01', 24, 1)
    const categoriaId = inserirCategoria(db)

    new DespesaRepository(db).criarUnicaCredito({
      descricao: 'Compra',
      categoriaId,
      cartaoId,
      valorCentavos: 10_000,
      dataCompra: '2026-08-09'
    })

    const agosto = repo.detalharSomenteLeitura('2026-08')
    const setembro = repo.detalharSomenteLeitura('2026-09')

    expect(agosto.faturas).toHaveLength(1)
    expect(agosto.faturas[0].fatura.dataVencimento).toBe('2026-09-01')
    expect(agosto.faturas[0].totalCentavos).toBe(10_000)
    expect(setembro.faturas).toEqual([])
  })
})
