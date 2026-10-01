import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { DespesaRepository } from '../repositories/despesa-repository'
import { FaturaRepository } from '../repositories/fatura-repository'
import { PagamentoParcialRepository } from '../repositories/pagamento-parcial-repository'
import { ParcelaRepository } from '../repositories/parcela-repository'

/**
 * RN-10 contra o SQLite: registrar, listar, somar e excluir pagamento parcial.
 *
 * A elegibilidade é do domínio (`podeRegistrarPagamentoParcial`); o que estes
 * testes guardam é que o repositório a consulta com o estado REAL da fatura —
 * o status de agora e o que falta pagar depois dos pagamentos já gravados — e
 * que uma recusa não deixa linha para trás.
 */
describe('PagamentoParcialRepository', () => {
  let db: Database
  let repo: PagamentoParcialRepository
  let despesas: DespesaRepository
  let faturas: FaturaRepository
  let cartaoId: number
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new PagamentoParcialRepository(db)
    despesas = new DespesaRepository(db)
    faturas = new FaturaRepository(db)
    cartaoId = Number(
      db
        .prepare(
          "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 5, 12, '#f70')"
        )
        .run().lastInsertRowid
    )
    categoriaId = Number(
      db.prepare("INSERT INTO categoria (nome, cor) VALUES ('Casa', '#aaa')").run().lastInsertRowid
    )
  })

  /** Compra à vista no crédito; devolve a fatura (Aberta) em que ela caiu. */
  function comprar(valorCentavos: number, dataCompra = '2099-06-03') {
    return despesas.criarUnicaCredito({
      descricao: `Compra de ${valorCentavos}`,
      categoriaId,
      cartaoId,
      valorCentavos,
      dataCompra
    })
  }

  function contarPagamentos(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM pagamento_parcial').get() as { n: number }).n
  }

  describe('registrar', () => {
    it('grava o pagamento e devolve a entidade', () => {
      const { fatura } = comprar(80000)

      const pagamento = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })

      expect(pagamento).toMatchObject({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })
      expect(pagamento.id).toBeGreaterThan(0)
      expect(pagamento.createdAt).toBeTruthy()
      expect(repo.listarPorFatura(fatura.id)).toEqual([pagamento])
    })

    // Padrão E: pagamento parcial não é transição de ciclo de vida.
    it('não muda o status da fatura nem das parcelas', () => {
      const { fatura, parcela } = comprar(80000)

      repo.registrar({ faturaId: fatura.id, valorCentavos: 20000, dataPagamento: '2099-05-20' })

      expect(faturas.findById(fatura.id)?.status).toEqual({ kind: 'Aberta' })
      const depois = new ParcelaRepository(db).listarPorFatura(fatura.id)[0]
      expect(depois).toMatchObject({ id: parcela.id, status: 'Pendente', dataPagamento: null })
    })

    it('recusa fatura que não existe', () => {
      expect(() =>
        repo.registrar({ faturaId: 999, valorCentavos: 20000, dataPagamento: '2099-05-20' })
      ).toThrow('Fatura #999 não encontrada')
    })

    it('recusa fatura Paga, apontando a reabertura', () => {
      const { fatura } = comprar(80000)
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')

      expect(() =>
        repo.registrar({ faturaId: fatura.id, valorCentavos: 20000, dataPagamento: '2099-06-13' })
      ).toThrow(/Reabra a fatura/)
      expect(contarPagamentos()).toBe(0)
    })

    it('recusa valor acima do total da fatura', () => {
      const { fatura } = comprar(80000)

      expect(() =>
        repo.registrar({ faturaId: fatura.id, valorCentavos: 80001, dataPagamento: '2099-05-20' })
      ).toThrow(/falta pagar/)
      expect(contarPagamentos()).toBe(0)
    })

    // O teto é o que FALTA, não o total: o segundo pagamento enxerga o primeiro.
    it('o teto do segundo pagamento desconta o primeiro', () => {
      const { fatura } = comprar(80000)
      repo.registrar({ faturaId: fatura.id, valorCentavos: 50000, dataPagamento: '2099-05-20' })

      expect(() =>
        repo.registrar({ faturaId: fatura.id, valorCentavos: 40000, dataPagamento: '2099-05-21' })
      ).toThrow(/falta pagar/)

      // Aberta aceita o valor igual ao que falta: ainda não pode ser paga.
      repo.registrar({ faturaId: fatura.id, valorCentavos: 30000, dataPagamento: '2099-05-21' })
      expect(repo.somarPorFatura(fatura.id)).toBe(80000)
    })

    // O total é a soma de TODAS as parcelas da fatura, não da primeira.
    it('o teto soma todas as compras da fatura', () => {
      const { fatura } = comprar(50000)
      comprar(30000)

      repo.registrar({ faturaId: fatura.id, valorCentavos: 70000, dataPagamento: '2099-05-20' })

      expect(repo.somarPorFatura(fatura.id)).toBe(70000)
    })

    it('em fatura Fechada, recusa o valor que quita e aponta "Marcar como paga"', () => {
      const { fatura } = comprar(80000)
      faturas.fechar(fatura.id)

      expect(() =>
        repo.registrar({ faturaId: fatura.id, valorCentavos: 80000, dataPagamento: '2099-06-06' })
      ).toThrow(/Marcar como paga/)
      expect(contarPagamentos()).toBe(0)
    })

    it('em fatura Fechada, aceita valor abaixo do que falta', () => {
      const { fatura } = comprar(80000)
      faturas.fechar(fatura.id)

      repo.registrar({ faturaId: fatura.id, valorCentavos: 79999, dataPagamento: '2099-06-06' })

      expect(repo.somarPorFatura(fatura.id)).toBe(79999)
    })

    // Defesa em profundidade: o schema do IPC já barra os dois, mas o
    // repositório também é chamado por código que não passa por ele.
    it.each([
      ['valor zero', { valorCentavos: 0, dataPagamento: '2099-05-20' }, /maior que zero/],
      ['data impossível', { valorCentavos: 20000, dataPagamento: '2099-02-30' }, /inválida/]
    ])('recusa %s sem gravar nada', (_caso, entrada, mensagem) => {
      const { fatura } = comprar(80000)

      expect(() => repo.registrar({ faturaId: fatura.id, ...entrada })).toThrow(mensagem)
      expect(contarPagamentos()).toBe(0)
    })

    it('recusa pagamento em fatura sem compra nenhuma', () => {
      const vazia = faturas.upsertParaMesReferencia(
        { id: cartaoId, diaFechamento: 5, diaVencimento: 12 },
        '2099-09'
      )

      expect(() =>
        repo.registrar({ faturaId: vazia.id, valorCentavos: 1, dataPagamento: '2099-08-20' })
      ).toThrow(/falta pagar/)
    })
  })

  describe('listarPorFatura', () => {
    it('ordena por data do pagamento e, no mesmo dia, pela ordem de registro', () => {
      const { fatura } = comprar(80000)
      const tarde = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 10000,
        dataPagamento: '2099-05-25'
      })
      const cedo = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-10'
      })
      const tardeDeNovo = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 5000,
        dataPagamento: '2099-05-25'
      })

      expect(repo.listarPorFatura(fatura.id).map((p) => p.id)).toEqual([
        cedo.id,
        tarde.id,
        tardeDeNovo.id
      ])
    })

    it('traz só os pagamentos da fatura pedida', () => {
      const junho = comprar(80000, '2099-06-03').fatura
      const julho = comprar(50000, '2099-07-03').fatura
      repo.registrar({ faturaId: junho.id, valorCentavos: 20000, dataPagamento: '2099-05-20' })
      repo.registrar({ faturaId: julho.id, valorCentavos: 10000, dataPagamento: '2099-06-20' })

      expect(repo.listarPorFatura(junho.id).map((p) => p.valorCentavos)).toEqual([20000])
      expect(repo.listarPorFatura(julho.id).map((p) => p.valorCentavos)).toEqual([10000])
    })

    it('fatura sem pagamento devolve lista vazia', () => {
      const { fatura } = comprar(80000)

      expect(repo.listarPorFatura(fatura.id)).toEqual([])
    })
  })

  describe('somarPorFatura', () => {
    it('soma os pagamentos da fatura', () => {
      const { fatura } = comprar(80000)
      repo.registrar({ faturaId: fatura.id, valorCentavos: 20000, dataPagamento: '2099-05-20' })
      repo.registrar({ faturaId: fatura.id, valorCentavos: 15050, dataPagamento: '2099-05-22' })

      expect(repo.somarPorFatura(fatura.id)).toBe(35050)
    })

    it('é zero, e não nulo, para fatura sem pagamento', () => {
      const { fatura } = comprar(80000)

      expect(repo.somarPorFatura(fatura.id)).toBe(0)
    })
  })

  describe('excluir', () => {
    it('remove o pagamento, e o que falta pagar volta', () => {
      const { fatura } = comprar(80000)
      const pagamento = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })

      repo.excluir(pagamento.id)

      expect(repo.listarPorFatura(fatura.id)).toEqual([])
      expect(repo.somarPorFatura(fatura.id)).toBe(0)
    })

    it('remove só o pagamento pedido', () => {
      const { fatura } = comprar(80000)
      const primeiro = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })
      repo.registrar({ faturaId: fatura.id, valorCentavos: 10000, dataPagamento: '2099-05-21' })

      repo.excluir(primeiro.id)

      expect(repo.somarPorFatura(fatura.id)).toBe(10000)
    })

    it('recusa pagamento que não existe', () => {
      expect(() => repo.excluir(999)).toThrow('Pagamento parcial #999 não encontrado')
    })

    it('recusa em fatura Paga, e o pagamento fica', () => {
      const { fatura } = comprar(80000)
      const pagamento = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')

      expect(() => repo.excluir(pagamento.id)).toThrow(/Reabra a fatura/)
      expect(contarPagamentos()).toBe(1)
    })

    // A escotilha de RF-FAT-05 vale aqui também: reabrir devolve a exclusão.
    it('depois de reabrir a fatura, a exclusão volta a valer', () => {
      const { fatura } = comprar(80000)
      const pagamento = repo.registrar({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')
      faturas.reabrir(fatura.id, 'Fechada')

      repo.excluir(pagamento.id)

      expect(contarPagamentos()).toBe(0)
    })
  })

  /**
   * Pagar a fatura paga o RESTANTE: os pagamentos parciais são histórico do que
   * já tinha sido pago, e não podem sumir nem com o pagamento nem com a
   * reabertura (R8).
   */
  describe('ciclo de vida da fatura', () => {
    it('pagar e reabrir a fatura preservam os pagamentos parciais', () => {
      const { fatura } = comprar(80000)
      repo.registrar({ faturaId: fatura.id, valorCentavos: 20000, dataPagamento: '2099-05-20' })

      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')
      expect(repo.somarPorFatura(fatura.id)).toBe(20000)

      faturas.reabrir(fatura.id, 'Fechada')
      expect(repo.somarPorFatura(fatura.id)).toBe(20000)
    })

    // Padrão E: o parcial não trava a despesa. Excluir a compra depois de
    // pagar deixa a fatura com mais pago do que comprado — estado que as
    // leituras precisam aguentar (R1), e não que a exclusão precise impedir.
    it('excluir a despesa depois do pagamento segue permitido', () => {
      const { fatura, despesa } = comprar(80000)
      repo.registrar({ faturaId: fatura.id, valorCentavos: 20000, dataPagamento: '2099-05-20' })

      despesas.excluir(despesa.id)

      expect(repo.somarPorFatura(fatura.id)).toBe(20000)
      expect(new ParcelaRepository(db).listarPorFatura(fatura.id)).toEqual([])
    })
  })
})
