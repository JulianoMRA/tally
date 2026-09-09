import { describe, it, expect, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import type { Database } from '../../../src/persistence/database'
import { openInMemoryDatabase } from '../../../src/persistence/database'
import { runMigrations } from '../../../src/persistence/migrations/runner'
import { DESPESA_IPC_CHANNELS } from '../../../src/shared/ipc/despesa'
import { registerDespesaHandlers } from '../despesa-handlers'

type Handler = (evento: unknown, payload: unknown) => unknown

/**
 * `ipcMain` falso: guarda o que foi registrado e deixa o teste invocar o
 * handler direto. Mesmo padrão de `simulacao-handlers.test.ts`, que é o que
 * torna a camada `electron/` testável sem subir o Electron.
 */
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
 * RF-DES-21 na fronteira do IPC.
 *
 * O repositório já tem os testes da regra; o que falta cobrir aqui é o que só
 * existe nesta camada: os schemas Zod recusarem payload malformado ANTES de o
 * repositório ser chamado. Um handler sem essa prova aceita `parcelaId` como
 * string e deixa a validação para o SQLite.
 */
describe('handlers de ocorrência paga (RF-DES-21)', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let parcelaId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerDespesaHandlers(db, ipc.ipcMain)

    const catId = Number(
      db.prepare("INSERT INTO categoria (nome, cor) VALUES ('Casa', '#aaa')").run().lastInsertRowid
    )
    const despesaId = Number(
      db
        .prepare(
          `INSERT INTO despesa (descricao, categoria_id, tipo, forma_pagamento, cartao_id, valor_centavos, data_compra, dia_cobranca)
           VALUES ('Aluguel', ?, 'Assinatura', 'Pix', NULL, 150000, '2026-09-10', 10)`
        )
        .run(catId).lastInsertRowid
    )
    parcelaId = Number(
      db
        .prepare(
          `INSERT INTO parcela (despesa_id, fatura_id, numero, total, valor_centavos, data_referencia)
           VALUES (?, NULL, 1, NULL, 150000, '2026-09-10')`
        )
        .run(despesaId).lastInsertRowid
    )
  })

  it('marca a ocorrência e devolve a parcela atualizada', () => {
    const parcela = ipc.invocar(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, {
      parcelaId,
      dataPagamento: '2026-09-11'
    }) as { status: string; dataPagamento: string | null }

    expect(parcela.status).toBe('Paga')
    expect(parcela.dataPagamento).toBe('2026-09-11')
  })

  it('desmarca e devolve a parcela pendente', () => {
    ipc.invocar(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, {
      parcelaId,
      dataPagamento: '2026-09-11'
    })

    const parcela = ipc.invocar(DESPESA_IPC_CHANNELS.desmarcarOcorrenciaPaga, {
      parcelaId
    }) as { status: string; dataPagamento: string | null }

    expect(parcela.status).toBe('Pendente')
    expect(parcela.dataPagamento).toBeNull()
  })

  it('recusa data de pagamento que não existe no calendário', () => {
    // 31/09 não existe. O `dataIsoSchema` reprova por round-trip, e não por
    // regex — `new Date('2026-09-31')` rolaria para 01/10 em silêncio.
    expect(() =>
      ipc.invocar(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, {
        parcelaId,
        dataPagamento: '2026-09-31'
      })
    ).toThrow()
  })

  it('recusa parcelaId que não é inteiro positivo', () => {
    expect(() =>
      ipc.invocar(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, {
        parcelaId: '1',
        dataPagamento: '2026-09-11'
      })
    ).toThrow()

    expect(() =>
      ipc.invocar(DESPESA_IPC_CHANNELS.desmarcarOcorrenciaPaga, { parcelaId: 0 })
    ).toThrow()
  })

  it('recusa marcar sem data de pagamento', () => {
    expect(() => ipc.invocar(DESPESA_IPC_CHANNELS.marcarOcorrenciaPaga, { parcelaId })).toThrow()
  })

  /**
   * `listarOcorrenciasDoMes` passou a expor `faturaId`, que é o campo pelo qual
   * a UI decide se oferece a ação. Se ele sumisse do mapeamento, o menu ficaria
   * errado sem nenhum teste reclamar.
   */
  it('a ocorrência do mês carrega faturaId nulo quando não há fatura', () => {
    const linhas = ipc.invocar(DESPESA_IPC_CHANNELS.listarOcorrenciasDoMes, {
      mesReferencia: '2026-09'
    }) as { faturaId: number | null; descricao: string }[]

    expect(linhas).toHaveLength(1)
    expect(linhas[0].descricao).toBe('Aluguel')
    expect(linhas[0].faturaId).toBeNull()
  })
})
