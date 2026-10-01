import { describe, it, expect, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
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
