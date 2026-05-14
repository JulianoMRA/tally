import type { IpcMain } from 'electron'
import type Database from 'better-sqlite3'
import { CategoriaRepository } from '../../src/persistence/repositories/categoria-repository'
import { categoriaInputSchema, CATEGORIA_IPC_CHANNELS } from '../../src/shared/ipc/categoria'
import type { ListCategoriaOptions } from '../../src/shared/ipc/categoria'

export function registerCategoriaHandlers(db: Database.Database, ipcMain: IpcMain): void {
  const repo = new CategoriaRepository(db)

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.list, (_event, options?: ListCategoriaOptions) => {
    return repo.list(options)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.findById, (_event, id: number) => {
    return repo.findById(id)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.create, (_event, payload: unknown) => {
    const input = categoriaInputSchema.parse(payload)
    return repo.create(input)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.update, (_event, id: number, payload: unknown) => {
    const input = categoriaInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.arquivar, (_event, id: number) => {
    return repo.arquivar(id)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.desarquivar, (_event, id: number) => {
    return repo.desarquivar(id)
  })
}
