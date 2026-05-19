import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { AjudaRepository } from '../../src/persistence/repositories/ajuda-repository'
import {
  criarAjudaInputSchema,
  marcarAjudaRecebidaInputSchema,
  excluirAjudaInputSchema,
  listarAjudasPorParcelaInputSchema,
  listarAjudasAgrupadasInputSchema,
  AJUDA_IPC_CHANNELS
} from '../../src/shared/ipc/ajuda'

export function registerAjudaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new AjudaRepository(db)

  ipcMain.handle(AJUDA_IPC_CHANNELS.criar, (_event, payload: unknown) => {
    const input = criarAjudaInputSchema.parse(payload)
    return repo.criar(input)
  })

  ipcMain.handle(AJUDA_IPC_CHANNELS.marcarRecebida, (_event, payload: unknown) => {
    const { ajudaId, dataRecebimento } = marcarAjudaRecebidaInputSchema.parse(payload)
    return repo.marcarRecebida(ajudaId, dataRecebimento)
  })

  ipcMain.handle(AJUDA_IPC_CHANNELS.excluir, (_event, payload: unknown) => {
    const { ajudaId } = excluirAjudaInputSchema.parse(payload)
    return repo.excluir(ajudaId)
  })

  ipcMain.handle(AJUDA_IPC_CHANNELS.listarPorParcela, (_event, payload: unknown) => {
    const { parcelaId } = listarAjudasPorParcelaInputSchema.parse(payload)
    return repo.listarPorParcela(parcelaId)
  })

  ipcMain.handle(AJUDA_IPC_CHANNELS.listarAgrupadoPorContribuidor, (_event, payload: unknown) => {
    const filtro = listarAjudasAgrupadasInputSchema.parse(payload ?? {})
    return repo.listarAgrupadoPorContribuidor(filtro)
  })
}
