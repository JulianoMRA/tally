import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { CartaoRepository } from '../../src/persistence/repositories/cartao-repository'
import {
  cartaoIdSchema,
  cartaoInputSchema,
  CARTAO_IPC_CHANNELS,
  listCartaoOptionsSchema
} from '../../src/shared/ipc/cartao'

export function registerCartaoHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new CartaoRepository(db)

  ipcMain.handle(CARTAO_IPC_CHANNELS.list, (_event, payload: unknown) => {
    const options = listCartaoOptionsSchema.parse(payload)
    return repo.list(options)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.findById, (_event, payload: unknown) => {
    return repo.findById(cartaoIdSchema.parse(payload))
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.create, (_event, payload: unknown) => {
    const input = cartaoInputSchema.parse(payload)
    return repo.create(input)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.update, (_event, idRaw: unknown, payload: unknown) => {
    const id = cartaoIdSchema.parse(idRaw)
    const input = cartaoInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.arquivar, (_event, payload: unknown) => {
    return repo.arquivar(cartaoIdSchema.parse(payload))
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.desarquivar, (_event, payload: unknown) => {
    return repo.desarquivar(cartaoIdSchema.parse(payload))
  })
}
