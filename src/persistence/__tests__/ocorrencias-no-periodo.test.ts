import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'

function inserirCategoria(db: Database, nome: string): number {
  return Number(
    db.prepare("INSERT INTO categoria (nome, cor) VALUES (?, '#aaa')").run(nome).lastInsertRowid
  )
}

function inserirCartao(db: Database, nome: string, diaFechamento = 5): number {
  return Number(
    db
      .prepare(
        'INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, 12, ?)'
      )
      .run(nome, diaFechamento, '#000').lastInsertRowid
  )
}

/**
 * RF-DES-22 — a consulta que atravessa meses.
 *
 * O recorte do mês é o mesmo de `listarOcorrenciasDoMes` (RF-DES-14): a
 * ocorrência COM fatura pertence ao mês da fatura, e a sem fatura ao mês da
 * `data_referencia`. Estes testes existem sobretudo para travar isso — se o
 * período usasse `data_compra`, uma compra feita depois do fechamento
 * apareceria num mês em que não impacta nada.
 */
describe('DespesaRepository.listarOcorrenciasNoPeriodo', () => {
  let db: Database
  let repo: DespesaRepository
  let catId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new DespesaRepository(db)
    catId = inserirCategoria(db, 'Casa')
  })

  it('devolve ocorrências dos meses dentro do intervalo, inclusive nas pontas', () => {
    const cartaoId = inserirCartao(db, 'Inter')
    repo.criarParceladaCredito({
      descricao: 'Notebook',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 6,
      valorTotalCentavos: 600000,
      dataCompra: '2026-01-03'
    })

    // 6 parcelas: 2026-01 .. 2026-06. O intervalo pega quatro delas.
    const linhas = repo.listarOcorrenciasNoPeriodo('2026-02', '2026-05')

    expect(linhas).toHaveLength(4)
    expect(linhas.map((l) => l.mes_referencia).sort()).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05'
    ])
  })

  it('intervalo de um mês só devolve o mesmo que a consulta mensal', () => {
    const cartaoId = inserirCartao(db, 'Inter')
    repo.criarUnicaCredito({
      descricao: 'Mercado',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 8500,
      dataCompra: '2026-03-01'
    })
    repo.criarUnicaForaCartao({
      descricao: 'Feira',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorCentavos: 3000,
      dataCompra: '2026-03-10'
    })

    const periodo = repo.listarOcorrenciasNoPeriodo('2026-03', '2026-03')
    const mes = repo.listarOcorrenciasDoMes('2026-03')

    expect(periodo).toEqual(mes)
    expect(periodo).toHaveLength(2)
  })

  /**
   * O ponto do recorte. Compra em 07/03 num cartão que fecha dia 5 cai na
   * fatura de ABRIL (RN-01). Um período que termina em março não pode
   * devolvê-la, e um que começa em abril tem de devolvê-la — mesmo a
   * `data_compra` sendo de março.
   */
  it('usa o mês da fatura, e não o da compra, para decidir o recorte', () => {
    const cartaoId = inserirCartao(db, 'Inter', 5)
    repo.criarUnicaCredito({
      descricao: 'Depois do fechamento',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 5000,
      dataCompra: '2026-03-07'
    })

    expect(repo.listarOcorrenciasNoPeriodo('2026-01', '2026-03')).toHaveLength(0)

    const emAbril = repo.listarOcorrenciasNoPeriodo('2026-04', '2026-04')
    expect(emAbril).toHaveLength(1)
    expect(emAbril[0].data_compra).toBe('2026-03-07')
    expect(emAbril[0].mes_referencia).toBe('2026-04')
  })

  it('devolve vazio quando o intervalo não tem nada', () => {
    expect(repo.listarOcorrenciasNoPeriodo('2020-01', '2020-12')).toEqual([])
  })

  // Intervalo invertido é engano de chamada, não um caso de negócio: devolver
  // vazio em silêncio esconderia o erro atrás de "nenhum resultado".
  it('recusa intervalo invertido', () => {
    expect(() => repo.listarOcorrenciasNoPeriodo('2026-06', '2026-01')).toThrow(
      /inv[eé]rtid|ordem/i
    )
  })

  it('ordena do mês mais recente para o mais antigo', () => {
    const cartaoId = inserirCartao(db, 'Inter')
    repo.criarParceladaCredito({
      descricao: 'Curso',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-01-03'
    })

    const linhas = repo.listarOcorrenciasNoPeriodo('2026-01', '2026-03')

    expect(linhas.map((l) => l.mes_referencia)).toEqual(['2026-03', '2026-02', '2026-01'])
  })
})
