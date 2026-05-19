import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { DespesaRepository } from '../../src/persistence/repositories/despesa-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputSchema,
  adiantarParcelasInputSchema,
  cancelarPendentesInputSchema,
  DESPESA_IPC_CHANNELS
} from '../../src/shared/ipc/despesa'

export function registerDespesaHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new DespesaRepository(db)
  const parcelaRepo = new ParcelaRepository(db)

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarUnicaCredito, (_event, payload: unknown) => {
    const input = despesaUnicaCreditoInputSchema.parse(payload)
    return repo.criarUnicaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarParceladaCredito, (_event, payload: unknown) => {
    const input = despesaParceladaCreditoInputSchema.parse(payload)
    return repo.criarParceladaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarParceladaEmAndamento, (_event, payload: unknown) => {
    const input = despesaEmAndamentoInputSchema.parse(payload)
    return repo.criarParceladaEmAndamento(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.adiantarParcelas, (_event, payload: unknown) => {
    const input = adiantarParcelasInputSchema.parse(payload)
    return parcelaRepo.adiantar(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.cancelarPendentes, (_event, payload: unknown) => {
    const { despesaId } = cancelarPendentesInputSchema.parse(payload)
    return parcelaRepo.cancelarPendentes(despesaId)
  })
}
