import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { RendaRepository } from '../../src/persistence/repositories/renda-repository'
import {
  criarRendaAvulsaInputSchema,
  criarRendaRecorrenteInputSchema,
  updateRendaInputSchema,
  RENDA_IPC_CHANNELS
} from '../../src/shared/ipc/renda'
import type { ListRendaOptions } from '../../src/shared/ipc/renda'

export function registerRendaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new RendaRepository(db)

  ipcMain.handle(RENDA_IPC_CHANNELS.list, (_event, options?: ListRendaOptions) => {
    return repo.list(options)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.findById, (_event, id: number) => {
    return repo.findById(id)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.criarAvulsa, (_event, payload: unknown) => {
    const input = criarRendaAvulsaInputSchema.parse(payload)
    return repo.criarAvulsa(input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.criarRecorrente, (_event, payload: unknown) => {
    const input = criarRendaRecorrenteInputSchema.parse(payload)
    return repo.criarRecorrente(input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.update, (_event, id: number, payload: unknown) => {
    const input = updateRendaInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.arquivar, (_event, id: number) => {
    return repo.arquivar(id)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.desarquivar, (_event, id: number) => {
    return repo.desarquivar(id)
  })
}
