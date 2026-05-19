import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { ContribuidorRepository } from '../../src/persistence/repositories/contribuidor-repository'
import {
  contribuidorInputSchema,
  CONTRIBUIDOR_IPC_CHANNELS
} from '../../src/shared/ipc/contribuidor'
import type { ListContribuidorOptions } from '../../src/shared/ipc/contribuidor'

export function registerContribuidorHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new ContribuidorRepository(db)

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.list, (_event, options?: ListContribuidorOptions) => {
    return repo.list(options)
  })

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.findById, (_event, id: number) => {
    return repo.findById(id)
  })

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.create, (_event, payload: unknown) => {
    const input = contribuidorInputSchema.parse(payload)
    return repo.create(input)
  })

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.update, (_event, id: number, payload: unknown) => {
    const input = contribuidorInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.arquivar, (_event, id: number) => {
    return repo.arquivar(id)
  })

  ipcMain.handle(CONTRIBUIDOR_IPC_CHANNELS.desarquivar, (_event, id: number) => {
    return repo.desarquivar(id)
  })
}
