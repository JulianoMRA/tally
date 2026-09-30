import { describe, it, expect, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import type { Database } from '../../../src/persistence/database'
import { openInMemoryDatabase } from '../../../src/persistence/database'
import { runMigrations } from '../../../src/persistence/migrations/runner'
import { FATURA_IPC_CHANNELS, type FaturaComTotal } from '../../../src/shared/ipc/fatura'
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
