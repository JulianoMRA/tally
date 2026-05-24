import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { CategoriaRepository } from '../../src/persistence/repositories/categoria-repository'
import {
  categoriaIdSchema,
  categoriaInputSchema,
  CATEGORIA_IPC_CHANNELS,
  listCategoriaOptionsSchema
} from '../../src/shared/ipc/categoria'

export function registerCategoriaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new CategoriaRepository(db)

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.list, (_event, payload: unknown) => {
    const options = listCategoriaOptionsSchema.parse(payload)
    return repo.list(options)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.findById, (_event, payload: unknown) => {
    return repo.findById(categoriaIdSchema.parse(payload))
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.create, (_event, payload: unknown) => {
    const input = categoriaInputSchema.parse(payload)
    return repo.create(input)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.update, (_event, idRaw: unknown, payload: unknown) => {
    const id = categoriaIdSchema.parse(idRaw)
    const input = categoriaInputSchema.parse(payload)
    return repo.update(id, input)
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.arquivar, (_event, payload: unknown) => {
    return repo.arquivar(categoriaIdSchema.parse(payload))
  })

  ipcMain.handle(CATEGORIA_IPC_CHANNELS.desarquivar, (_event, payload: unknown) => {
    return repo.desarquivar(categoriaIdSchema.parse(payload))
  })
}
