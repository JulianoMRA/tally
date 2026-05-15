import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { DespesaRepository } from '../../src/persistence/repositories/despesa-repository'
import { despesaUnicaCreditoInputSchema, DESPESA_IPC_CHANNELS } from '../../src/shared/ipc/despesa'

export function registerDespesaHandlers(db: Database.Database, ipcMain: IpcMain): void {
  const repo = new DespesaRepository(db)

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarUnicaCredito, (_event, payload: unknown) => {
    const input = despesaUnicaCreditoInputSchema.parse(payload)
    return repo.criarUnicaCredito(input)
  })
}
