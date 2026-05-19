import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { RecebimentoRepository } from '../../src/persistence/repositories/recebimento-repository'
import {
  criarRecebimentoAvulsoInputSchema,
  marcarRecebidoInputSchema,
  excluirRecebimentoInputSchema,
  listarRecebimentosInputSchema,
  RECEBIMENTO_IPC_CHANNELS
} from '../../src/shared/ipc/recebimento'

export function registerRecebimentoHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new RecebimentoRepository(db)

  ipcMain.handle(RECEBIMENTO_IPC_CHANNELS.criarAvulso, (_event, payload: unknown) => {
    const input = criarRecebimentoAvulsoInputSchema.parse(payload)
    const recebimento = repo.criarAvulsoCompleto(input)
    return { recebimento }
  })

  ipcMain.handle(RECEBIMENTO_IPC_CHANNELS.listar, (_event, payload: unknown) => {
    const filtro = listarRecebimentosInputSchema.parse(payload ?? {})
    return repo.listar(filtro)
  })

  ipcMain.handle(RECEBIMENTO_IPC_CHANNELS.marcarRecebido, (_event, payload: unknown) => {
    const { recebimentoId, dataRecebida } = marcarRecebidoInputSchema.parse(payload)
    return repo.marcarRecebido(recebimentoId, dataRecebida)
  })

  ipcMain.handle(RECEBIMENTO_IPC_CHANNELS.excluir, (_event, payload: unknown) => {
    const { recebimentoId } = excluirRecebimentoInputSchema.parse(payload)
    return repo.excluir(recebimentoId)
  })
}
