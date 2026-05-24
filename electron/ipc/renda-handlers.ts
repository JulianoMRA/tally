import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { RendaRepository } from '../../src/persistence/repositories/renda-repository'
import {
  criarRendaAvulsaInputSchema,
  criarRendaRecorrenteInputSchema,
  listRendaOptionsSchema,
  rendaIdSchema,
  updateRendaInputSchema,
  RENDA_IPC_CHANNELS
} from '../../src/shared/ipc/renda'

export function registerRendaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new RendaRepository(db)

  ipcMain.handle(RENDA_IPC_CHANNELS.list, (_event, payload: unknown) => {
    const options = listRendaOptionsSchema.parse(payload)
    return repo.list(options)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.findById, (_event, payload: unknown) => {
    return repo.findById(rendaIdSchema.parse(payload))
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.criarAvulsa, (_event, payload: unknown) => {
    const input = criarRendaAvulsaInputSchema.parse(payload)
    return repo.criarAvulsa(input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.criarRecorrente, (_event, payload: unknown) => {
    const input = criarRendaRecorrenteInputSchema.parse(payload)
    return repo.criarRecorrente(input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.update, (_event, idRaw: unknown, payload: unknown) => {
    const id = rendaIdSchema.parse(idRaw)
    const input = updateRendaInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.arquivar, (_event, payload: unknown) => {
    return repo.arquivar(rendaIdSchema.parse(payload))
  })

  ipcMain.handle(RENDA_IPC_CHANNELS.desarquivar, (_event, payload: unknown) => {
    return repo.desarquivar(rendaIdSchema.parse(payload))
  })
}
