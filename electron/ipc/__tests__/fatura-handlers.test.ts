import { describe, it, expect, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import type { PagamentoParcial } from '../../../src/domain/entities/pagamento-parcial'
import type { Database } from '../../../src/persistence/database'
import { openInMemoryDatabase } from '../../../src/persistence/database'
import { runMigrations } from '../../../src/persistence/migrations/runner'
import { DespesaRepository } from '../../../src/persistence/repositories/despesa-repository'
import { FaturaRepository } from '../../../src/persistence/repositories/fatura-repository'
import {
  FATURA_IPC_CHANNELS,
  type FaturaComTotal,
  type FaturaDetalhada
} from '../../../src/shared/ipc/fatura'
import { registerFaturaHandlers } from '../fatura-handlers'

type Handler = (evento: unknown, payload: unknown) => unknown

/** `ipcMain` falso, o mesmo de `despesa-handlers-ocorrencia.test.ts`. */
function ipcMainFalso(): {
  ipcMain: IpcMain
  invocar: (canal: string, payload?: unknown) => unknown
} {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (canal: string, handler: Handler) => handlers.set(canal, handler)
  } as unknown as IpcMain

  return {
    ipcMain,
    invocar: (canal, payload) => {
      const handler = handlers.get(canal)
      if (!handler) throw new Error(`Canal nao registrado: ${canal}`)
      return handler({}, payload)
    }
  }
}

/**
 * RN-06 no caminho de leitura da tela de Faturas.
 *
 * A fatura nasce sempre `Aberta` — inclusive a de um lançamento retroativo — e
 * só fechava no boot, no timer de uma hora ou ao abrir a Visão mensal. Até lá
 * Faturas a mostrava Aberta, oferecendo "Fechar fatura" e sem aviso de vencida,
 * enquanto a Visão mensal mostrava a mesma fatura Fechada.
 */
describe('listarResumoPorCartao fecha as faturas vencidas antes de listar', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let cartaoId: number

  function inserirFatura(mesReferencia: string, dataFechamento: string, dataVencimento: string) {
    db.prepare(
      `INSERT INTO fatura (cartao_id, mes_referencia, data_fechamento, data_vencimento, status)
       VALUES (?, ?, ?, ?, 'Aberta')`
    ).run(cartaoId, mesReferencia, dataFechamento, dataVencimento)
  }

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerFaturaHandlers(db, ipc.ipcMain)

    cartaoId = Number(
      db
        .prepare(
          "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 5, 12, '#f70')"
        )
        .run().lastInsertRowid
    )
  })

  it('a fatura com fechamento no passado chega Fechada', () => {
    inserirFatura('2020-06', '2020-06-05', '2020-06-12')

    const [fatura] = ipc.invocar(
      FATURA_IPC_CHANNELS.listarResumoPorCartao,
      cartaoId
    ) as FaturaComTotal[]

    expect(fatura?.fatura.status.kind).toBe('Fechada')
  })

  it('a fatura com fechamento no futuro continua Aberta', () => {
    inserirFatura('2099-06', '2099-06-05', '2099-06-12')

    const [fatura] = ipc.invocar(
      FATURA_IPC_CHANNELS.listarResumoPorCartao,
      cartaoId
    ) as FaturaComTotal[]

    expect(fatura?.fatura.status.kind).toBe('Aberta')
  })
})

/**
 * RF-DES-09 na fronteira do IPC: o detalhe da fatura diz, por despesa, se a
 * exclusão está bloqueada. A tela oferecia Excluir em toda parcela pendente e
 * só descobria o bloqueio depois do diálogo "irreversível".
 */
describe('detalharComParcelas traz o bloqueio de exclusão por despesa', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let repo: DespesaRepository
  let cartaoId: number
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerFaturaHandlers(db, ipc.ipcMain)
    repo = new DespesaRepository(db)

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

  it('a parcelada cuja primeira parcela fechou vem bloqueada, vista da fatura seguinte', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'TV',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2099-06-03'
    })
    new FaturaRepository(db).fechar(r.parcelas[0]!.faturaId!)

    const detalhe = ipc.invocar(
      FATURA_IPC_CHANNELS.detalharComParcelas,
      r.parcelas[1]!.faturaId
    ) as FaturaDetalhada

    expect(detalhe.exclusaoBloqueada).toEqual({
      [r.despesa.id]: 'has-parcela-em-fatura-fechada'
    })
  })

  it('despesa que pode ser excluída não aparece', () => {
    const r = repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2099-06-03'
    })

    const detalhe = ipc.invocar(
      FATURA_IPC_CHANNELS.detalharComParcelas,
      r.fatura.id
    ) as FaturaDetalhada

    expect(detalhe.exclusaoBloqueada).toEqual({})
  })
})

/**
 * RF-DES-14 na fatura: a coluna Parcela usa o vocabulário de Saídas ("à vista",
 * "mensal", "1/3 de R$ X"), que vem de `descreverOcorrencia`. O valor de origem
 * só existe para a parcelada criada do zero, e isso depende do menor número de
 * parcela da despesa — dado que a fatura, sozinha, não tem.
 */
describe('detalharComParcelas descreve a ocorrência de cada parcela', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let repo: DespesaRepository
  let cartaoId: number
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerFaturaHandlers(db, ipc.ipcMain)
    repo = new DespesaRepository(db)

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

  function detalhar(faturaId: number | null): FaturaDetalhada {
    return ipc.invocar(FATURA_IPC_CHANNELS.detalharComParcelas, faturaId) as FaturaDetalhada
  }

  it('compra à vista é "à vista", sem valor de origem', () => {
    const r = repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2099-06-03'
    })

    const ocorrencia = detalhar(r.fatura.id).ocorrenciaPorParcela?.[r.parcela.id]

    expect(ocorrencia?.rotuloParcela).toBe('à vista')
    expect(ocorrencia?.origemCentavos).toBeNull()
  })

  it('parcelada criada do zero traz o número e o valor da compra', () => {
    const r = repo.criarParceladaCredito({
      descricao: 'TV',
      categoriaId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2099-06-03'
    })
    const segunda = r.parcelas[1]!

    const ocorrencia = detalhar(segunda.faturaId).ocorrenciaPorParcela?.[segunda.id]

    expect(ocorrencia?.rotuloParcela).toBe('2/3')
    expect(ocorrencia?.origemCentavos).toBe(3000)
  })

  // Cadastrada em andamento, a despesa guarda o saldo devedor, e não o preço
  // da compra: mostrar "de R$ X" ali seria rotular dívida como preço.
  it('parcelada cadastrada em andamento não traz valor de origem', () => {
    const r = repo.criarParceladaEmAndamento({
      descricao: 'Sofá',
      categoriaId,
      cartaoId,
      totalParcelas: 10,
      parcelaAtual: 4,
      valorRestanteCentavos: 7000,
      dataCompra: '2099-06-03'
    })
    const primeira = r.parcelas[0]!

    const ocorrencia = detalhar(primeira.faturaId).ocorrenciaPorParcela?.[primeira.id]

    expect(ocorrencia?.rotuloParcela).toBe('4/10')
    expect(ocorrencia?.origemCentavos).toBeNull()
  })

  it('assinatura é "mensal"', () => {
    const r = repo.criarAssinaturaCredito({
      descricao: 'Streaming',
      categoriaId,
      cartaoId,
      valorMensalCentavos: 3990,
      dataInicio: '2099-06-03'
    })
    const primeira = r.parcelas[0]!

    const ocorrencia = detalhar(primeira.faturaId).ocorrenciaPorParcela?.[primeira.id]

    expect(ocorrencia?.rotuloParcela).toBe('mensal')
  })
})

/**
 * RN-10 na fronteira do IPC: registrar e excluir pagamento parcial, e as duas
 * leituras da tela de Faturas trazendo o que já foi pago e o que falta.
 *
 * O repositório tem os testes da regra. Aqui fica o que só existe nesta camada:
 * o schema recusar payload malformado ANTES do repositório, e os campos novos
 * chegarem ao contrato que o renderer consome.
 */
describe('pagamento parcial (RN-10)', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let repo: DespesaRepository
  let cartaoId: number
  let categoriaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerFaturaHandlers(db, ipc.ipcMain)
    repo = new DespesaRepository(db)

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

  /** Compra à vista em 03/06/2099: cai na fatura de junho, que segue Aberta. */
  function comprar(valorCentavos: number) {
    return repo.criarUnicaCredito({
      descricao: `Compra de ${valorCentavos}`,
      categoriaId,
      cartaoId,
      valorCentavos,
      dataCompra: '2099-06-03'
    })
  }

  function registrar(faturaId: number, valorCentavos: number, dataPagamento = '2099-05-20') {
    return ipc.invocar(FATURA_IPC_CHANNELS.registrarPagamentoParcial, {
      faturaId,
      valorCentavos,
      dataPagamento
    }) as PagamentoParcial
  }

  function detalhar(faturaId: number): FaturaDetalhada {
    return ipc.invocar(FATURA_IPC_CHANNELS.detalharComParcelas, faturaId) as FaturaDetalhada
  }

  function contarPagamentos(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM pagamento_parcial').get() as { n: number }).n
  }

  function erroDe(acao: () => unknown): Error {
    try {
      acao()
    } catch (e) {
      return e as Error
    }
    throw new Error('a ação não lançou')
  }

  describe('registrarPagamentoParcial', () => {
    it('grava e devolve o pagamento', () => {
      const { fatura } = comprar(80000)

      const pagamento = registrar(fatura.id, 20000, '2099-05-20')

      expect(pagamento).toMatchObject({
        faturaId: fatura.id,
        valorCentavos: 20000,
        dataPagamento: '2099-05-20'
      })
      expect(contarPagamentos()).toBe(1)
    })

    // Os quatro primeiros o domínio também recusaria; o que o teste cobra é
    // QUEM recusa. Sem o schema, `valorCentavos: '200'` chegaria ao SQLite.
    it.each([
      ['valor zero', { valorCentavos: 0 }],
      ['valor fracionário', { valorCentavos: 199.5 }],
      ['valor em texto', { valorCentavos: '20000' }],
      ['data que não existe no calendário', { dataPagamento: '2099-02-30' }],
      ['faturaId em texto', { faturaId: '1' }]
    ])('o schema recusa %s antes de chegar ao repositório', (_caso, campo) => {
      const { fatura } = comprar(80000)

      const erro = erroDe(() =>
        ipc.invocar(FATURA_IPC_CHANNELS.registrarPagamentoParcial, {
          faturaId: fatura.id,
          valorCentavos: 20000,
          dataPagamento: '2099-05-20',
          ...campo
        })
      )

      expect(erro.name).toBe('ZodError')
      expect(contarPagamentos()).toBe(0)
    })

    it('recusa payload vazio', () => {
      const erro = erroDe(() =>
        ipc.invocar(FATURA_IPC_CHANNELS.registrarPagamentoParcial, undefined)
      )

      expect(erro.name).toBe('ZodError')
    })

    // É este texto que o diálogo de registro mostra quando o main recusa.
    it('a recusa do domínio chega com a mensagem que a tela mostra', () => {
      const { fatura } = comprar(80000)

      expect(() => registrar(fatura.id, 80001)).toThrow(
        'O valor passa do que falta pagar nesta fatura.'
      )
      expect(contarPagamentos()).toBe(0)
    })

    it('recusa fatura Paga, apontando a reabertura', () => {
      const { fatura } = comprar(80000)
      const faturas = new FaturaRepository(db)
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')

      expect(() => registrar(fatura.id, 20000)).toThrow(/Reabra a fatura/)
    })

    it('recusa fatura que não existe', () => {
      expect(() => registrar(999, 20000)).toThrow('Fatura #999 não encontrada')
    })
  })

  describe('excluirPagamentoParcial', () => {
    it('remove o pagamento', () => {
      const { fatura } = comprar(80000)
      const pagamento = registrar(fatura.id, 20000)

      ipc.invocar(FATURA_IPC_CHANNELS.excluirPagamentoParcial, { pagamentoId: pagamento.id })

      expect(contarPagamentos()).toBe(0)
      expect(detalhar(fatura.id).restanteCentavos).toBe(80000)
    })

    it.each([
      ['em texto', { pagamentoId: '1' }],
      ['zero', { pagamentoId: 0 }],
      ['ausente', {}]
    ])('o schema recusa pagamentoId %s', (_caso, payload) => {
      const { fatura } = comprar(80000)
      registrar(fatura.id, 20000)

      const erro = erroDe(() => ipc.invocar(FATURA_IPC_CHANNELS.excluirPagamentoParcial, payload))

      expect(erro.name).toBe('ZodError')
      expect(contarPagamentos()).toBe(1)
    })

    it('recusa pagamento que não existe', () => {
      expect(() =>
        ipc.invocar(FATURA_IPC_CHANNELS.excluirPagamentoParcial, { pagamentoId: 999 })
      ).toThrow('Pagamento parcial #999 não encontrado')
    })

    it('recusa em fatura Paga, e o pagamento fica', () => {
      const { fatura } = comprar(80000)
      const pagamento = registrar(fatura.id, 20000)
      const faturas = new FaturaRepository(db)
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')

      expect(() =>
        ipc.invocar(FATURA_IPC_CHANNELS.excluirPagamentoParcial, { pagamentoId: pagamento.id })
      ).toThrow(/Reabra a fatura/)
      expect(contarPagamentos()).toBe(1)
    })
  })

  describe('detalharComParcelas', () => {
    it('sem pagamento parcial: lista vazia, pago zero e falta pagar o total', () => {
      const { fatura } = comprar(80000)

      expect(detalhar(fatura.id)).toMatchObject({
        totalCentavos: 80000,
        pagoParcialCentavos: 0,
        restanteCentavos: 80000,
        excedenteCentavos: 0,
        pagamentosParciais: []
      })
    })

    it('com pagamentos: a lista por data, o pago somado e o que falta abatido', () => {
      const { fatura } = comprar(80000)
      registrar(fatura.id, 10000, '2099-05-25')
      registrar(fatura.id, 15000, '2099-05-10')

      const detalhe = detalhar(fatura.id)

      expect(detalhe).toMatchObject({
        totalCentavos: 80000,
        pagoParcialCentavos: 25000,
        restanteCentavos: 55000,
        excedenteCentavos: 0
      })
      expect(detalhe.pagamentosParciais.map((p) => p.dataPagamento)).toEqual([
        '2099-05-10',
        '2099-05-25'
      ])
    })

    // A despesa foi excluída depois do pagamento, o que a fatura Aberta deixa.
    // O detalhe é o único lugar que diz QUANTO foi pago a mais.
    it('pago a mais: falta zero e a diferença no excedente', () => {
      const { fatura, despesa } = comprar(80000)
      comprar(10000)
      registrar(fatura.id, 50000)
      repo.excluir(despesa.id)

      expect(detalhar(fatura.id)).toMatchObject({
        totalCentavos: 10000,
        pagoParcialCentavos: 50000,
        restanteCentavos: 0,
        excedenteCentavos: 40000
      })
    })

    it('fatura paga com parcial segue trazendo os pagamentos', () => {
      const { fatura } = comprar(80000)
      registrar(fatura.id, 20000)
      const faturas = new FaturaRepository(db)
      faturas.fechar(fatura.id)
      faturas.pagar(fatura.id, '2099-06-12')

      const detalhe = detalhar(fatura.id)

      expect(detalhe.fatura.status).toEqual({ kind: 'Paga', pagaEm: '2099-06-12' })
      expect(detalhe).toMatchObject({ pagoParcialCentavos: 20000, restanteCentavos: 60000 })
      expect(detalhe.pagamentosParciais).toHaveLength(1)
    })
  })

  describe('listarResumoPorCartao', () => {
    it('traz o pago e o que falta de cada fatura', () => {
      const { fatura } = comprar(80000)
      registrar(fatura.id, 20000)

      const [linha] = ipc.invocar(
        FATURA_IPC_CHANNELS.listarResumoPorCartao,
        cartaoId
      ) as FaturaComTotal[]

      expect(linha).toMatchObject({
        totalCentavos: 80000,
        pagoParcialCentavos: 20000,
        restanteCentavos: 60000
      })
    })
  })
})
