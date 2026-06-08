import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { OrcamentoRepository } from '../../src/persistence/repositories/orcamento-repository'
import { RelatorioRepository } from '../../src/persistence/repositories/relatorio-repository'
import { montarVisaoOrcamento } from '../../src/domain/services/calcular-orcamento'
import {
  categoriaIdSchema,
  definirLimiteInputSchema,
  listarProgressoInputSchema,
  ORCAMENTO_IPC_CHANNELS
} from '../../src/shared/ipc/orcamento'

export function registerOrcamentoHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new OrcamentoRepository(db)
  const relatorioRepo = new RelatorioRepository(db)

  ipcMain.handle(ORCAMENTO_IPC_CHANNELS.definirLimite, (_event, payload: unknown) => {
    const { categoriaId, valorLimiteCentavos } = definirLimiteInputSchema.parse(payload)
    return repo.definirLimite(categoriaId, valorLimiteCentavos)
  })

  ipcMain.handle(ORCAMENTO_IPC_CHANNELS.removerLimite, (_event, payload: unknown) => {
    repo.removerLimite(categoriaIdSchema.parse(payload))
  })

  ipcMain.handle(ORCAMENTO_IPC_CHANNELS.listarProgresso, (_event, payload: unknown) => {
    const { mesReferencia } = listarProgressoInputSchema.parse(payload)
    const limites = repo.listarLimitesGlobais()
    const realizado = relatorioRepo.totaisPorCategoriaEmMes(mesReferencia)
    return montarVisaoOrcamento(limites, realizado)
  })
}
