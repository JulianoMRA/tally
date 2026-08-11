import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { FaturaRepository } from '../repositories/fatura-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'

type CartaoFixture = { id: number; diaFechamento: number; diaVencimento: number }

function inserirCartao(
  db: Database,
  nome: string,
  diaFechamento: number,
  diaVencimento: number
): CartaoFixture {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, diaFechamento, diaVencimento, '#000')
  return { id: Number(info.lastInsertRowid), diaFechamento, diaVencimento }
}

describe('FaturaRepository.upsertParaCompra', () => {
  let db: Database
  let repo: FaturaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
  })

  it('cria fatura nova alinhada à RN-01 para cartão Inter (F=5/V=12) com compra 07/06/2026', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)

    const fatura = repo.upsertParaCompra(inter, '2026-06-07')

    expect(fatura).toMatchObject({
      cartaoId: inter.id,
      mesReferencia: '2026-07',
      dataFechamento: '2026-07-05',
      dataVencimento: '2026-07-12',
      status: { kind: 'Aberta' }
    })
  })

  it('é idempotente — segunda chamada para a mesma referência devolve a mesma fatura', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)

    const primeira = repo.upsertParaCompra(inter, '2026-06-07')
    const segunda = repo.upsertParaCompra(inter, '2026-06-08')

    expect(segunda.id).toBe(primeira.id)
    expect(repo.list(inter.id)).toHaveLength(1)
  })

  it('cria faturas distintas quando a compra cai antes ou depois do fechamento', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)

    repo.upsertParaCompra(inter, '2026-06-03') // junho
    repo.upsertParaCompra(inter, '2026-06-07') // julho

    const faturas = repo.list(inter.id)
    expect(faturas.map((f) => f.mesReferencia)).toEqual(['2026-06', '2026-07'])
  })

  it('clampa data_fechamento para o último dia do mês quando dia > dias do mês (F=31 em fevereiro)', () => {
    const cartao = inserirCartao(db, 'Estranho', 31, 31)

    const fatura = repo.upsertParaCompra(cartao, '2027-02-15')

    expect(fatura.mesReferencia).toBe('2027-02')
    expect(fatura.dataFechamento).toBe('2027-02-28')
    expect(fatura.dataVencimento).toBe('2027-02-28')
  })

  it('clampa para 29 em fevereiro de ano bissexto', () => {
    const cartao = inserirCartao(db, 'Bissexto', 31, 31)

    const fatura = repo.upsertParaCompra(cartao, '2028-02-15')
    expect(fatura.dataFechamento).toBe('2028-02-29')
  })

  it('vence no mês seguinte quando o dia de vencimento é anterior ao de fechamento (F=24, V=01)', () => {
    const cartao = inserirCartao(db, 'Fecha24Vence01', 24, 1)

    const fatura = repo.upsertParaCompra(cartao, '2026-08-09')

    expect(fatura).toMatchObject({
      mesReferencia: '2026-08',
      dataFechamento: '2026-08-24',
      dataVencimento: '2026-09-01'
    })
  })

  it('mantém o vencimento após o fechamento também na compra que rola de mês (F=24, V=01)', () => {
    const cartao = inserirCartao(db, 'Fecha24Vence01', 24, 1)

    const fatura = repo.upsertParaCompra(cartao, '2026-08-25')

    expect(fatura).toMatchObject({
      mesReferencia: '2026-09',
      dataFechamento: '2026-09-24',
      dataVencimento: '2026-10-01'
    })
  })

  it('upsertParaMesReferencia aplica a mesma regra de vencimento (F=24, V=01)', () => {
    const cartao = inserirCartao(db, 'Fecha24Vence01', 24, 1)

    const fatura = repo.upsertParaMesReferencia(cartao, '2026-12')

    expect(fatura).toMatchObject({
      dataFechamento: '2026-12-24',
      dataVencimento: '2027-01-01'
    })
  })

  it('mapeia status row → discriminated union', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const fatura = repo.upsertParaCompra(inter, '2026-06-03')

    db.prepare("UPDATE fatura SET status = 'Fechada' WHERE id = ?").run(fatura.id)
    expect(repo.findByCartaoEMesReferencia(inter.id, '2026-06')?.status).toEqual({
      kind: 'Fechada'
    })

    db.prepare("UPDATE fatura SET status = 'Paga', data_pagamento = '2026-06-12' WHERE id = ?").run(
      fatura.id
    )
    expect(repo.findByCartaoEMesReferencia(inter.id, '2026-06')?.status).toEqual({
      kind: 'Paga',
      pagaEm: '2026-06-12'
    })
  })

  it('list() sem filtro retorna faturas de todos os cartões', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const nubank = inserirCartao(db, 'Nubank', 15, 22)

    repo.upsertParaCompra(inter, '2026-06-03')
    repo.upsertParaCompra(nubank, '2026-06-10')

    expect(repo.list()).toHaveLength(2)
  })
})

describe('FaturaRepository — sincronização parcela <-> fatura (RN-06)', () => {
  let db: Database
  let repo: FaturaRepository
  let despesaRepo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
    despesaRepo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    categoriaId = Number(
      db
        .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Mercado', 'Despesa', '#aaa')")
        .run().lastInsertRowid
    )
  })

  function criarFaturaComParcelas(): { faturaId: number; despesaId: number } {
    const cartao = inserirCartao(db, 'Inter', 5, 12)
    const r = despesaRepo.criarParceladaCredito({
      descricao: 'Geladeira',
      categoriaId,
      cartaoId: cartao.id,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2026-06-03'
    })
    const faturaId = r.parcelas[0].faturaId
    if (faturaId === null) throw new Error('setup: parcela de crédito sem fatura')
    return { faturaId, despesaId: r.despesa.id }
  }

  it('pagar marca as parcelas Pendente da fatura como Paga com a data do pagamento', () => {
    const { faturaId } = criarFaturaComParcelas()
    repo.fechar(faturaId)

    repo.pagar(faturaId, '2026-06-12')

    const parcelas = parcelaRepo.listarPorFatura(faturaId)
    expect(parcelas).toHaveLength(1)
    expect(parcelas[0].status).toBe('Paga')
    expect(parcelas[0].dataPagamento).toBe('2026-06-12')
  })

  it('pagar não toca parcelas de outras faturas da mesma despesa', () => {
    const { faturaId, despesaId } = criarFaturaComParcelas()
    repo.fechar(faturaId)

    repo.pagar(faturaId, '2026-06-12')

    const outras = parcelaRepo.listarPorDespesa(despesaId).filter((p) => p.faturaId !== faturaId)
    expect(outras).toHaveLength(2)
    for (const p of outras) {
      expect(p.status).toBe('Pendente')
      expect(p.dataPagamento).toBeNull()
    }
  })

  it('reabrir como Aberta reverte as parcelas da fatura para Pendente e limpa data_pagamento', () => {
    const { faturaId } = criarFaturaComParcelas()
    repo.fechar(faturaId)
    repo.pagar(faturaId, '2026-06-12')

    const fatura = repo.reabrir(faturaId, 'Aberta')

    expect(fatura.status).toEqual({ kind: 'Aberta' })
    const parcelas = parcelaRepo.listarPorFatura(faturaId)
    expect(parcelas[0].status).toBe('Pendente')
    expect(parcelas[0].dataPagamento).toBeNull()
  })

  it('reabrir como Fechada (fatura vencida) deixa Fechada com parcelas Pendente', () => {
    const { faturaId } = criarFaturaComParcelas()
    repo.fechar(faturaId)
    repo.pagar(faturaId, '2026-06-12')

    const fatura = repo.reabrir(faturaId, 'Fechada')

    expect(fatura.status).toEqual({ kind: 'Fechada' })
    const parcelas = parcelaRepo.listarPorFatura(faturaId)
    expect(parcelas[0].status).toBe('Pendente')
    expect(parcelas[0].dataPagamento).toBeNull()
  })

  it('fechar não altera o status das parcelas', () => {
    const { faturaId } = criarFaturaComParcelas()

    repo.fechar(faturaId)

    const parcelas = parcelaRepo.listarPorFatura(faturaId)
    expect(parcelas[0].status).toBe('Pendente')
  })
})

describe('FaturaRepository.realinharDatasDoCartao', () => {
  let db: Database
  let repo: FaturaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
  })

  function inserirFatura(
    cartaoId: number,
    mes: string,
    fechamento: string,
    vencimento: string,
    status: 'Aberta' | 'Fechada' | 'Paga'
  ): number {
    const info = db
      .prepare(
        `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(cartaoId, mes, fechamento, vencimento, status, status === 'Paga' ? vencimento : null)
    return Number(info.lastInsertRowid)
  }

  it('fatura Aberta realinha fechamento e vencimento aos novos dias do cartao', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const id = inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-12', 'Aberta')

    repo.realinharDatasDoCartao({ id: inter.id, diaFechamento: 10, diaVencimento: 20 })

    expect(repo.findById(id)).toMatchObject({
      mesReferencia: '2026-07',
      dataFechamento: '2026-07-10',
      dataVencimento: '2026-07-20'
    })
  })

  it('fatura Fechada mantem o fechamento ja ocorrido e realinha so o vencimento', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const id = inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-12', 'Fechada')

    repo.realinharDatasDoCartao({ id: inter.id, diaFechamento: 10, diaVencimento: 20 })

    expect(repo.findById(id)).toMatchObject({
      dataFechamento: '2026-07-05',
      dataVencimento: '2026-07-20'
    })
  })

  it('fatura Paga fica intocada — e historico', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const id = inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-12', 'Paga')

    repo.realinharDatasDoCartao({ id: inter.id, diaFechamento: 10, diaVencimento: 20 })

    expect(repo.findById(id)).toMatchObject({
      dataFechamento: '2026-07-05',
      dataVencimento: '2026-07-12'
    })
  })

  it('RN-01: vencimento volta para o mes do fechamento quando V deixa de ser menor que F', () => {
    // Caso real: cartao criado com F=24/V=01 (vencimento no mes seguinte) e
    // depois corrigido para V=30, com a fatura ja criada pela configuracao antiga.
    const inter = inserirCartao(db, 'Inter', 24, 1)
    const id = inserirFatura(inter.id, '2026-09', '2026-09-24', '2026-10-01', 'Aberta')

    repo.realinharDatasDoCartao({ id: inter.id, diaFechamento: 24, diaVencimento: 30 })

    expect(repo.findById(id)).toMatchObject({
      dataFechamento: '2026-09-24',
      dataVencimento: '2026-09-30'
    })
  })

  it('nao toca em faturas de outros cartoes e devolve quantas realinhou', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const nubank = inserirCartao(db, 'Nubank', 15, 22)
    inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-12', 'Aberta')
    inserirFatura(inter.id, '2026-08', '2026-08-05', '2026-08-12', 'Aberta')
    const idNubank = inserirFatura(nubank.id, '2026-07', '2026-07-15', '2026-07-22', 'Aberta')

    const alteradas = repo.realinharDatasDoCartao({
      id: inter.id,
      diaFechamento: 10,
      diaVencimento: 20
    })

    expect(alteradas).toBe(2)
    expect(repo.findById(idNubank)).toMatchObject({
      dataFechamento: '2026-07-15',
      dataVencimento: '2026-07-22'
    })
  })

  it('nao conta fatura que ja estava com as datas certas', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-12', 'Aberta')

    const alteradas = repo.realinharDatasDoCartao({
      id: inter.id,
      diaFechamento: 5,
      diaVencimento: 12
    })

    expect(alteradas).toBe(0)
  })
})

describe('FaturaRepository.listarAvisos (fase 7 — notificações)', () => {
  let db: Database
  let repo: FaturaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new FaturaRepository(db)
  })

  function inserirFatura(
    cartaoId: number,
    mes: string,
    fechamento: string,
    vencimento: string,
    status: 'Aberta' | 'Fechada' | 'Paga'
  ): number {
    const info = db
      .prepare(
        `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status, data_pagamento)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(cartaoId, mes, fechamento, vencimento, status, status === 'Paga' ? vencimento : null)
    return Number(info.lastInsertRowid)
  }

  it('lista Abertas com fechamento na janela e Fechadas com vencimento na janela', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const nubank = inserirCartao(db, 'Nubank', 15, 22)
    // Aberta fechando em 3 dias → aviso de fechamento
    inserirFatura(inter.id, '2026-08', '2026-07-19', '2026-07-26', 'Aberta')
    // Fechada vencendo em 2 dias → aviso de vencimento
    inserirFatura(nubank.id, '2026-07', '2026-07-15', '2026-07-18', 'Fechada')

    const avisos = repo.listarAvisos('2026-07-16', '2026-07-19')

    expect(avisos).toHaveLength(2)
    expect(avisos).toContainEqual(
      expect.objectContaining({ tipo: 'fechamento', cartaoNome: 'Inter' })
    )
    expect(avisos).toContainEqual(
      expect.objectContaining({ tipo: 'vencimento', cartaoNome: 'Nubank' })
    )
  })

  it('ignora faturas fora da janela, Pagas e status incompatível com o tipo de aviso', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    // Aberta fechando longe demais
    inserirFatura(inter.id, '2026-09', '2026-08-05', '2026-08-12', 'Aberta')
    // Fechada com vencimento passado (nao avisa retroativo)
    inserirFatura(inter.id, '2026-06', '2026-06-05', '2026-06-12', 'Fechada')
    // Paga nunca gera aviso
    inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-17', 'Paga')

    expect(repo.listarAvisos('2026-07-16', '2026-07-19')).toEqual([])
  })

  it('fatura Aberta com vencimento proximo nao gera aviso de vencimento (primeiro fecha)', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    inserirFatura(inter.id, '2026-07', '2026-07-05', '2026-07-17', 'Aberta')

    const avisos = repo.listarAvisos('2026-07-16', '2026-07-19')
    expect(avisos.filter((a) => a.tipo === 'vencimento')).toEqual([])
  })

  it('nao avisa fatura sem parcelas de cartao arquivado', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    inserirFatura(inter.id, '2026-08', '2026-07-19', '2026-07-26', 'Aberta')
    db.prepare('UPDATE cartao SET ativo = 0 WHERE id = ?').run(inter.id)

    expect(repo.listarAvisos('2026-07-16', '2026-07-19')).toEqual([])
  })

  it('RF-CAR-02: avisa fatura com parcelas de cartao arquivado (ainda ha o que pagar)', () => {
    const inter = inserirCartao(db, 'Inter', 5, 12)
    const catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Geral', 'Despesa', '#000')")
      .run().lastInsertRowid as number
    new DespesaRepository(db).criarUnicaCredito({
      descricao: 'Compra antes de arquivar',
      categoriaId: Number(catId),
      cartaoId: inter.id,
      valorCentavos: 5000,
      dataCompra: '2026-07-10' // dia 10 > F=5 → fatura de agosto, fecha 2026-08-05
    })
    db.prepare('UPDATE cartao SET ativo = 0 WHERE id = ?').run(inter.id)

    const avisos = repo.listarAvisos('2026-08-03', '2026-08-06')

    expect(avisos).toContainEqual(
      expect.objectContaining({ tipo: 'fechamento', cartaoNome: 'Inter' })
    )
  })
})
