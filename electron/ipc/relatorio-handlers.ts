import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { RelatorioRepository } from '../../src/persistence/repositories/relatorio-repository'
import {
  totaisPorCategoriaInputSchema,
  evolucaoSaldoInputSchema,
  evolucaoCategoriaInputSchema,
  RELATORIO_IPC_CHANNELS
} from '../../src/shared/ipc/relatorio'

export function registerRelatorioHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new RelatorioRepository(db)

  ipcMain.handle(RELATORIO_IPC_CHANNELS.totaisPorCategoria, (_event, payload: unknown) => {
    const { mesReferencia } = totaisPorCategoriaInputSchema.parse(payload)
    return repo.totaisPorCategoriaEmMes(mesReferencia)
  })

  ipcMain.handle(RELATORIO_IPC_CHANNELS.evolucaoSaldo, (_event, payload: unknown) => {
    const { mesFinal, meses } = evolucaoSaldoInputSchema.parse(payload)
    return repo.evolucaoSaldoMensal(mesFinal, meses)
  })

  ipcMain.handle(RELATORIO_IPC_CHANNELS.evolucaoCategoria, (_event, payload: unknown) => {
    const { categoriaId, mesFinal, meses } = evolucaoCategoriaInputSchema.parse(payload)
    return repo.evolucaoCategoriaMensal(categoriaId, mesFinal, meses)
  })
}
