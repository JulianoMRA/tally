import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'

function inserirCartao(db: Database, nome: string, dF: number, dV: number): number {
  const info = db
    .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
    .run(nome, dF, dV, '#000')
  return Number(info.lastInsertRowid)
}

function inserirCategoria(db: Database): number {
  const info = db
    .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Alimentação', 'Despesa', '#aaa')")
    .run()
  return Number(info.lastInsertRowid)
}

describe('DespesaRepository.criarUnicaCredito', () => {
  let db: Database
  let repo: DespesaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
  })

  it('persiste despesa, fatura e parcela 1/1 retornando os três objetos', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const resultado = repo.criarUnicaCredito({
      descricao: 'Supermercado',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 8000,
      dataCompra: '2026-06-03'
    })

    expect(resultado.despesa.id).toBeGreaterThan(0)
    expect(resultado.despesa.descricao).toBe('Supermercado')
    expect(resultado.despesa.tipo).toBe('Unica')
    expect(resultado.despesa.formaPagamento).toBe('Credito')
    expect(resultado.despesa.cartaoId).toBe(cartaoId)
    expect(resultado.despesa.valorCentavos).toBe(8000)
    expect(resultado.despesa.totalParcelas).toBe(1)
    expect(resultado.despesa.ativa).toBe(true)

    expect(resultado.fatura.cartaoId).toBe(cartaoId)
    expect(resultado.fatura.mesReferencia).toBe('2026-06') // dia 03 <= F=05 → mesmo mês
    expect(resultado.fatura.status).toEqual({ kind: 'Aberta' })

    expect(resultado.parcela.despesaId).toBe(resultado.despesa.id)
    expect(resultado.parcela.faturaId).toBe(resultado.fatura.id)
    expect(resultado.parcela.numero).toBe(1)
    expect(resultado.parcela.total).toBe(1)
    expect(resultado.parcela.valorCentavos).toBe(8000)
    expect(resultado.parcela.dataReferencia).toBe('2026-06-03')
    expect(resultado.parcela.status).toBe('Pendente')
  })

  it('RN-01: compra após fechamento cria fatura no mês seguinte', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const resultado = repo.criarUnicaCredito({
      descricao: 'Farmácia',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 3000,
      dataCompra: '2026-06-07' // dia 07 > F=05 → fatura julho
    })

    expect(resultado.fatura.mesReferencia).toBe('2026-07')
  })

  it('duas despesas no mesmo ciclo reutilizam a mesma fatura (idempotência)', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    const r1 = repo.criarUnicaCredito({
      descricao: 'Despesa A',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 1000,
      dataCompra: '2026-06-03'
    })
    const r2 = repo.criarUnicaCredito({
      descricao: 'Despesa B',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2000,
      dataCompra: '2026-06-04'
    })

    expect(r2.fatura.id).toBe(r1.fatura.id)

    const faturasInter = db
      .prepare('SELECT count(*) as n FROM fatura WHERE cartao_id = ?')
      .get(cartaoId) as { n: number }
    expect(faturasInter.n).toBe(1)
  })

  it('operação é atômica: falha ao criar parcela reverte despesa e fatura', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5, 12)
    const catId = inserirCategoria(db)

    // Forçar falha no insert de parcela com valor_centavos negativo (viola CHECK)
    expect(() =>
      repo.criarUnicaCredito({
        descricao: 'Vai falhar',
        categoriaId: catId,
        cartaoId,
        valorCentavos: -1, // viola CHECK valor_centavos >= 0
        dataCompra: '2026-06-03'
      })
    ).toThrow()

    const despesas = db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }
    expect(despesas.n).toBe(0)
  })
})

describe('DespesaRepository.criarParceladaCredito (RF-DES-02, RN-02)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let cartaoId: number
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    cartaoId = db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
      .run('Nubank', 15, 22, '#000').lastInsertRowid as number
    catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Eletrônicos', 'Despesa', '#aaa')")
      .run().lastInsertRowid as number
  })

  it('persiste despesa com tipo Parcelada e totalParcelas correto', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-05-01'
    })

    expect(r.despesa.tipo).toBe('Parcelada')
    expect(r.despesa.totalParcelas).toBe(3)
    expect(r.despesa.valorCentavos).toBe(30000)
    expect(r.despesa.formaPagamento).toBe('Credito')
  })

  it('gera exatamente N parcelas no banco', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'TV',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 12,
      valorTotalCentavos: 120000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(12)
  })

  it('parcelas têm numeração sequencial 1/N, 2/N, ..., N/N', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Geladeira',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 4,
      valorTotalCentavos: 40000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    for (let i = 0; i < 4; i++) {
      expect(parcelas[i].numero).toBe(i + 1)
      expect(parcelas[i].total).toBe(4)
    }
  })

  it('cada parcela vinculada a uma fatura com mesReferencia distinto', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Celular',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-05-10' // F=15, compra dia 10 → fatura mai
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    const faturas = parcelas.map((p) => {
      const f = db.prepare('SELECT mes_referencia FROM fatura WHERE id = ?').get(p.faturaId) as {
        mes_referencia: string
      }
      return f.mes_referencia
    })

    expect(faturas).toEqual(['2026-05', '2026-06', '2026-07'])
  })

  it('soma dos valores das parcelas igual ao valorTotalCentavos', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'Monitor',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 7,
      valorTotalCentavos: 99999,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    const soma = parcelas.reduce((s, p) => s + p.valorCentavos, 0)
    expect(soma).toBe(99999)
  })

  it('operação é atômica — falha reverte tudo', () => {
    expect(() =>
      repo.criarParceladaCredito({
        descricao: 'Falha',
        categoriaId: catId,
        cartaoId: 9999, // cartão inexistente → FK fail
        totalParcelas: 2,
        valorTotalCentavos: 2000,
        dataCompra: '2026-05-01'
      })
    ).toThrow()

    const n = (db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }).n
    expect(n).toBe(0)
  })
})

describe('DespesaRepository.criarParceladaEmAndamento (RF-DES-03)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let cartaoId: number
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    cartaoId = db
      .prepare('INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?)')
      .run('Inter', 5, 12, '#000').lastInsertRowid as number
    catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Assinatura', 'Despesa', '#bbb')")
      .run().lastInsertRowid as number
  })

  it('gera apenas as parcelas restantes (K/N..N/N)', () => {
    const r = repo.criarParceladaEmAndamento({
      descricao: 'Notebook parcelado (em andamento)',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 12,
      parcelaAtual: 7,
      valorRestanteCentavos: 6000,
      dataCompra: '2026-05-01'
    })

    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(6)
    expect(parcelas[0].numero).toBe(7)
    expect(parcelas[0].total).toBe(12)
    expect(parcelas[5].numero).toBe(12)
  })

  it('despesa salva com totalParcelas = N (número original)', () => {
    const r = repo.criarParceladaEmAndamento({
      descricao: 'Em andamento',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 10,
      parcelaAtual: 9,
      valorRestanteCentavos: 2000,
      dataCompra: '2026-05-01'
    })

    expect(r.despesa.totalParcelas).toBe(10)
  })
})

describe('DespesaRepository — assinatura (RF-DES-04, RF-DES-07, RF-DES-08, RN-04)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let cartaoId: number
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    cartaoId = inserirCartao(db, 'Inter', 5, 12)
    catId = db
      .prepare("INSERT INTO categoria (nome, tipo, cor) VALUES ('Streaming', 'Despesa', '#bbb')")
      .run().lastInsertRowid as number
  })

  describe('criarAssinaturaCredito', () => {
    it('persiste despesa com tipo Assinatura, total_parcelas NULL e ativa=true', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      expect(r.despesa.tipo).toBe('Assinatura')
      expect(r.despesa.totalParcelas).toBeNull()
      expect(r.despesa.valorCentavos).toBe(2190)
      expect(r.despesa.ativa).toBe(true)
      expect(r.despesa.formaPagamento).toBe('Credito')
    })

    it('gera 12 ocorrências em 12 faturas distintas, todas com total=null', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      expect(r.parcelas).toHaveLength(12)
      for (const p of r.parcelas) {
        expect(p.total).toBeNull()
        expect(p.valorCentavos).toBe(2190)
      }

      const faturas = r.parcelas.map((p) => p.faturaId)
      expect(new Set(faturas).size).toBe(12)
    })

    it('primeira ocorrência usa RN-01 (dia <= fechamento → mês corrente)', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      const primeiraFatura = db
        .prepare('SELECT mes_referencia FROM fatura WHERE id = ?')
        .get(r.parcelas[0].faturaId) as { mes_referencia: string }
      expect(primeiraFatura.mes_referencia).toBe('2026-06')
    })

    it('é atômica — cartão inexistente reverte tudo', () => {
      expect(() =>
        repo.criarAssinaturaCredito({
          descricao: 'X',
          categoriaId: catId,
          cartaoId: 9999,
          valorMensalCentavos: 1000,
          dataInicio: '2026-06-03'
        })
      ).toThrow()

      const n = (db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }).n
      expect(n).toBe(0)
    })
  })

  describe('cancelarAssinatura (RF-DES-07)', () => {
    it('marca despesa como ativa=0 e deleta parcelas em faturas Aberta', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      const cancelamento = repo.cancelarAssinatura(r.despesa.id)

      expect(cancelamento.despesa.ativa).toBe(false)
      expect(cancelamento.canceladas).toHaveLength(12)

      const restantes = parcelaRepo.listarPorDespesa(r.despesa.id)
      expect(restantes).toHaveLength(0)
    })

    it('preserva parcelas em faturas Fechada ou Paga', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      // Marca as duas primeiras faturas como Fechada/Paga manualmente
      const faturaIds = r.parcelas.map((p) => p.faturaId)
      db.prepare("UPDATE fatura SET status = 'Fechada' WHERE id = ?").run(faturaIds[0])
      db.prepare(
        "UPDATE fatura SET status = 'Paga', data_pagamento = '2026-06-12' WHERE id = ?"
      ).run(faturaIds[1])

      const cancelamento = repo.cancelarAssinatura(r.despesa.id)

      expect(cancelamento.canceladas).toHaveLength(10)
      const restantes = parcelaRepo.listarPorDespesa(r.despesa.id)
      expect(restantes).toHaveLength(2)
      expect(restantes.map((p) => p.faturaId).sort()).toEqual([faturaIds[0], faturaIds[1]].sort())
    })

    it('rejeita despesa que não é assinatura', () => {
      const r = repo.criarUnicaCredito({
        descricao: 'Compra',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })

      expect(() => repo.cancelarAssinatura(r.despesa.id)).toThrow(/não é uma assinatura/)
    })
  })

  describe('reajustarValorMensalAssinatura (RF-DES-08)', () => {
    it('atualiza valor_centavos da despesa e das parcelas em faturas Aberta', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      const r2 = repo.reajustarValorMensalAssinatura(r.despesa.id, 2490)

      expect(r2.despesa.valorCentavos).toBe(2490)
      expect(r2.atualizadas).toHaveLength(12)

      const todas = parcelaRepo.listarPorDespesa(r.despesa.id)
      for (const p of todas) {
        expect(p.valorCentavos).toBe(2490)
      }
    })

    it('não toca em parcelas de faturas Fechada/Paga', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })
      const faturaIds = r.parcelas.map((p) => p.faturaId)
      db.prepare("UPDATE fatura SET status = 'Fechada' WHERE id = ?").run(faturaIds[0])

      repo.reajustarValorMensalAssinatura(r.despesa.id, 2490)

      const todas = parcelaRepo.listarPorDespesa(r.despesa.id)
      const parcelaFechada = todas.find((p) => p.faturaId === faturaIds[0])!
      expect(parcelaFechada.valorCentavos).toBe(2190)
      const parcelaAberta = todas.find((p) => p.faturaId === faturaIds[1])!
      expect(parcelaAberta.valorCentavos).toBe(2490)
    })

    it('valor inválido lança erro', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      expect(() => repo.reajustarValorMensalAssinatura(r.despesa.id, 0)).toThrow()
      expect(() => repo.reajustarValorMensalAssinatura(r.despesa.id, -100)).toThrow()
    })
  })

  describe('listarAssinaturas', () => {
    it('retorna só despesas tipo Assinatura', () => {
      repo.criarUnicaCredito({
        descricao: 'Compra',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 1000,
        dataCompra: '2026-06-03'
      })
      repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })

      const lista = repo.listarAssinaturas()
      expect(lista).toHaveLength(1)
      expect(lista[0].descricao).toBe('Spotify')
    })

    it('filtra por ativa=true exclui canceladas', () => {
      const r1 = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2190,
        dataInicio: '2026-06-03'
      })
      repo.criarAssinaturaCredito({
        descricao: 'Netflix',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 5500,
        dataInicio: '2026-06-03'
      })
      repo.cancelarAssinatura(r1.despesa.id)

      const ativas = repo.listarAssinaturas({ ativa: true })
      expect(ativas).toHaveLength(1)
      expect(ativas[0].descricao).toBe('Netflix')

      const canceladas = repo.listarAssinaturas({ ativa: false })
      expect(canceladas).toHaveLength(1)
      expect(canceladas[0].descricao).toBe('Spotify')

      const todas = repo.listarAssinaturas()
      expect(todas).toHaveLength(2)
    })
  })

  describe('estenderHorizonteAssinaturas (RF-VIS-04, RN-04)', () => {
    function mesesGerados(despesaId: number): string[] {
      type Row = { mes: string }
      const rows = db
        .prepare(
          `SELECT f.mes_referencia AS mes FROM parcela p
           INNER JOIN fatura f ON f.id = p.fatura_id
           WHERE p.despesa_id = ?
           ORDER BY f.mes_referencia ASC`
        )
        .all(despesaId) as Row[]
      return rows.map((r) => r.mes)
    }

    it('não cria nada quando o mes alvo está dentro do horizonte pré-gerado', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      const antes = mesesGerados(r.despesa.id)
      const resultado = repo.estenderHorizonteAssinaturas('2026-12')
      const depois = mesesGerados(r.despesa.id)

      expect(resultado.parcelasCriadas).toBe(0)
      expect(resultado.faturasCriadas).toBe(0)
      expect(depois).toEqual(antes)
    })

    it('estende em N meses quando o mes alvo está além do horizonte', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      // horizonte inicial: 2026-06 .. 2027-05 (12 meses)
      const resultado = repo.estenderHorizonteAssinaturas('2027-11')

      expect(resultado.parcelasCriadas).toBe(6)
      expect(resultado.faturasCriadas).toBe(6)

      const meses = mesesGerados(r.despesa.id)
      expect(meses).toHaveLength(18)
      expect(meses[meses.length - 1]).toBe('2027-11')

      const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
      const numeros = parcelas.map((p) => p.numero).sort((a, b) => a - b)
      expect(numeros).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
      for (const p of parcelas) {
        expect(p.valorCentavos).toBe(1000)
        expect(p.total).toBeNull()
      }
    })

    it('é idempotente: chamar duas vezes para o mesmo mes não duplica', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      repo.estenderHorizonteAssinaturas('2027-10')
      const segunda = repo.estenderHorizonteAssinaturas('2027-10')

      expect(segunda.parcelasCriadas).toBe(0)
      expect(segunda.faturasCriadas).toBe(0)

      const meses = mesesGerados(r.despesa.id)
      expect(new Set(meses).size).toBe(meses.length)
      expect(meses).toHaveLength(17)
    })

    it('não retroage: mes alvo no passado relativo ao último existente é ignorado', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      const resultado = repo.estenderHorizonteAssinaturas('2026-01')

      expect(resultado.parcelasCriadas).toBe(0)
      expect(resultado.faturasCriadas).toBe(0)
      expect(mesesGerados(r.despesa.id)).toHaveLength(12)
    })

    it('ignora assinaturas canceladas (ativa=0)', () => {
      const r = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 1000,
        dataInicio: '2026-06-03'
      })

      repo.cancelarAssinatura(r.despesa.id)
      const mesesAntes = mesesGerados(r.despesa.id)

      const resultado = repo.estenderHorizonteAssinaturas('2028-01')

      expect(resultado.parcelasCriadas).toBe(0)
      expect(mesesGerados(r.despesa.id)).toEqual(mesesAntes)
    })

    it('estende múltiplas assinaturas ativas em uma única chamada', () => {
      const cartao2 = inserirCartao(db, 'Nubank', 15, 22)

      const a = repo.criarAssinaturaCredito({
        descricao: 'Spotify',
        categoriaId: catId,
        cartaoId,
        valorMensalCentavos: 2000,
        dataInicio: '2026-06-03'
      })
      const b = repo.criarAssinaturaCredito({
        descricao: 'Netflix',
        categoriaId: catId,
        cartaoId: cartao2,
        valorMensalCentavos: 5000,
        dataInicio: '2026-06-10'
      })

      const resultado = repo.estenderHorizonteAssinaturas('2027-08')

      expect(resultado.parcelasCriadas).toBe(6)
      expect(mesesGerados(a.despesa.id)).toHaveLength(15)
      expect(mesesGerados(b.despesa.id)).toHaveLength(15)
    })
  })
})

describe('DespesaRepository — fora de cartão (RF-DES-01)', () => {
  let db: Database
  let repo: DespesaRepository
  let parcelaRepo: ParcelaRepository
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    parcelaRepo = new ParcelaRepository(db)
    catId = inserirCategoria(db)
  })

  describe('criarUnicaForaCartao', () => {
    it('persiste despesa Pix com cartao_id=NULL e parcela 1/1 com fatura_id=NULL', () => {
      const r = repo.criarUnicaForaCartao({
        descricao: 'Mercado',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 3500,
        dataCompra: '2026-06-10'
      })

      expect(r.despesa.tipo).toBe('Unica')
      expect(r.despesa.formaPagamento).toBe('Pix')
      expect(r.despesa.cartaoId).toBeNull()
      expect(r.despesa.totalParcelas).toBe(1)
      expect(r.despesa.valorCentavos).toBe(3500)
      expect(r.despesa.ativa).toBe(true)

      expect(r.parcela.faturaId).toBeNull()
      expect(r.parcela.numero).toBe(1)
      expect(r.parcela.total).toBe(1)
      expect(r.parcela.valorCentavos).toBe(3500)
      expect(r.parcela.dataReferencia).toBe('2026-06-10')
      expect(r.parcela.status).toBe('Pendente')
    })

    it('aceita Débito e Dinheiro também', () => {
      const r1 = repo.criarUnicaForaCartao({
        descricao: 'Débito',
        categoriaId: catId,
        formaPagamento: 'Debito',
        valorCentavos: 1000,
        dataCompra: '2026-06-10'
      })
      const r2 = repo.criarUnicaForaCartao({
        descricao: 'Cash',
        categoriaId: catId,
        formaPagamento: 'Dinheiro',
        valorCentavos: 500,
        dataCompra: '2026-06-10'
      })

      expect(r1.despesa.formaPagamento).toBe('Debito')
      expect(r2.despesa.formaPagamento).toBe('Dinheiro')
    })

    it('não cria fatura — apenas despesa + parcela', () => {
      repo.criarUnicaForaCartao({
        descricao: 'Pix',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 1000,
        dataCompra: '2026-06-10'
      })

      const faturas = db.prepare('SELECT count(*) as n FROM fatura').get() as { n: number }
      expect(faturas.n).toBe(0)
    })

    it('CHECK do schema rejeita Crédito sem cartão', () => {
      expect(() =>
        db
          .prepare(
            `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
             VALUES ('X', ?, 'Unica', 'Credito', NULL, 1000, 1, '2026-06-10')`
          )
          .run(catId)
      ).toThrow()
    })

    it('CHECK do schema rejeita Pix com cartão', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      expect(() =>
        db
          .prepare(
            `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, total_parcelas, data_compra)
             VALUES ('X', ?, 'Unica', 'Pix', ?, 1000, 1, '2026-06-10')`
          )
          .run(catId, cartaoId)
      ).toThrow()
    })

    it('é atômica — categoria inexistente reverte tudo', () => {
      expect(() =>
        repo.criarUnicaForaCartao({
          descricao: 'X',
          categoriaId: 9999,
          formaPagamento: 'Pix',
          valorCentavos: 1000,
          dataCompra: '2026-06-10'
        })
      ).toThrow()

      const n = (db.prepare('SELECT count(*) as n FROM despesa').get() as { n: number }).n
      expect(n).toBe(0)
      const np = (db.prepare('SELECT count(*) as n FROM parcela').get() as { n: number }).n
      expect(np).toBe(0)
    })
  })

  describe('listarGastosForaCartao', () => {
    it('retorna apenas despesas fora de cartão', () => {
      const cartaoId = inserirCartao(db, 'Inter', 5, 12)
      repo.criarUnicaCredito({
        descricao: 'Compra crédito',
        categoriaId: catId,
        cartaoId,
        valorCentavos: 2000,
        dataCompra: '2026-06-10'
      })
      repo.criarUnicaForaCartao({
        descricao: 'Pix mercado',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 3500,
        dataCompra: '2026-06-10'
      })

      const lista = repo.listarGastosForaCartao()
      expect(lista).toHaveLength(1)
      expect(lista[0].descricao).toBe('Pix mercado')
    })

    it('filtra por mês de referência (YYYY-MM)', () => {
      repo.criarUnicaForaCartao({
        descricao: 'Junho',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 1000,
        dataCompra: '2026-06-10'
      })
      repo.criarUnicaForaCartao({
        descricao: 'Julho',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 2000,
        dataCompra: '2026-07-15'
      })

      const junho = repo.listarGastosForaCartao({ mesReferencia: '2026-06' })
      expect(junho).toHaveLength(1)
      expect(junho[0].descricao).toBe('Junho')

      const julho = repo.listarGastosForaCartao({ mesReferencia: '2026-07' })
      expect(julho.map((g) => g.descricao)).toEqual(['Julho'])

      const agosto = repo.listarGastosForaCartao({ mesReferencia: '2026-08' })
      expect(agosto).toHaveLength(0)
    })

    it('ordena por data_compra desc', () => {
      repo.criarUnicaForaCartao({
        descricao: 'A',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 1000,
        dataCompra: '2026-06-05'
      })
      repo.criarUnicaForaCartao({
        descricao: 'B',
        categoriaId: catId,
        formaPagamento: 'Pix',
        valorCentavos: 1000,
        dataCompra: '2026-06-20'
      })

      const lista = repo.listarGastosForaCartao({ mesReferencia: '2026-06' })
      expect(lista.map((g) => g.descricao)).toEqual(['B', 'A'])
    })
  })

  it('ParcelaRepository.criar aceita faturaId=null', () => {
    const r = repo.criarUnicaForaCartao({
      descricao: 'Smoke',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorCentavos: 1000,
      dataCompra: '2026-06-10'
    })
    const parcelas = parcelaRepo.listarPorDespesa(r.despesa.id)
    expect(parcelas).toHaveLength(1)
    expect(parcelas[0].faturaId).toBeNull()
  })
})
