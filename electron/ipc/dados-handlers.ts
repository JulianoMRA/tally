import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { importarLinhas } from '../../src/persistence/importacao'
import { importarCsvInputSchema, DADOS_IPC_CHANNELS } from '../../src/shared/ipc/importacao'

export function registerDadosHandlers(db: Database, ipcMain: IpcMain): void {
  ipcMain.handle(DADOS_IPC_CHANNELS.importarCsv, (_event, payload: unknown) => {
    const { linhas } = importarCsvInputSchema.parse(payload)
    return importarLinhas(db, linhas)
  })
}
