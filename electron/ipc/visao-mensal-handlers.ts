import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { VisaoMensalRepository } from '../../src/persistence/repositories/visao-mensal-repository'
import {
  detalharMesInputSchema,
  VISAO_MENSAL_IPC_CHANNELS
} from '../../src/shared/ipc/visao-mensal'

export function registerVisaoMensalHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new VisaoMensalRepository(db)

  ipcMain.handle(VISAO_MENSAL_IPC_CHANNELS.detalhar, (_event, payload: unknown) => {
    const { mesReferencia } = detalharMesInputSchema.parse(payload)
    return repo.detalhar(mesReferencia)
  })
}
