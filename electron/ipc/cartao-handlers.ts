import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { CartaoRepository } from '../../src/persistence/repositories/cartao-repository'
import { cartaoInputSchema, CARTAO_IPC_CHANNELS } from '../../src/shared/ipc/cartao'
import type { ListCartaoOptions } from '../../src/shared/ipc/cartao'

export function registerCartaoHandlers(db: Database.Database, ipcMain: IpcMain): void {
  const repo = new CartaoRepository(db)

  ipcMain.handle(CARTAO_IPC_CHANNELS.list, (_event, options?: ListCartaoOptions) => {
    return repo.list(options)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.findById, (_event, id: number) => {
    return repo.findById(id)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.create, (_event, payload: unknown) => {
    const input = cartaoInputSchema.parse(payload)
    return repo.create(input)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.update, (_event, id: number, payload: unknown) => {
    const input = cartaoInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.arquivar, (_event, id: number) => {
    return repo.arquivar(id)
  })

  ipcMain.handle(CARTAO_IPC_CHANNELS.desarquivar, (_event, id: number) => {
    return repo.desarquivar(id)
  })
}
