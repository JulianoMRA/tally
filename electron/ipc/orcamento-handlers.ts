import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { OrcamentoRepository } from '../../src/persistence/repositories/orcamento-repository'
import { RelatorioRepository } from '../../src/persistence/repositories/relatorio-repository'
import { montarVisaoOrcamento } from '../../src/domain/services/calcular-orcamento'
import {
  definirLimiteInputSchema,
  removerLimiteInputSchema,
  listarProgressoInputSchema,
  ORCAMENTO_IPC_CHANNELS,
  type LinhaOrcamentoComOrigem
} from '../../src/shared/ipc/orcamento'

export function registerOrcamentoHandlers(db: Database, ipcMain: IpcMain): void {
  const repo = new OrcamentoRepository(db)
  const relatorioRepo = new RelatorioRepository(db)

  ipcMain.handle(ORCAMENTO_IPC_CHANNELS.definirLimite, (_event, payload: unknown) => {
    const { categoriaId, valorLimiteCentavos, mesReferencia } =
      definirLimiteInputSchema.parse(payload)
    return repo.definirLimite(categoriaId, valorLimiteCentavos, mesReferencia)
  })

  ipcMain.handle(ORCAMENTO_IPC_CHANNELS.removerLimite, (_event, payload: unknown) => {
    const { categoriaId, mesReferencia } = removerLimiteInputSchema.parse(payload)
    repo.removerLimite(categoriaId, mesReferencia)
  })

  ipcMain.handle(
    ORCAMENTO_IPC_CHANNELS.listarProgresso,
    (_event, payload: unknown): LinhaOrcamentoComOrigem[] => {
      const { mesReferencia } = listarProgressoInputSchema.parse(payload)
      const limites = repo.listarLimitesEfetivos(mesReferencia)
      const origemPorCategoria = new Map(limites.map((l) => [l.categoriaId, l.origem]))
      const realizado = relatorioRepo.totaisPorCategoriaEmMes(mesReferencia)
      return montarVisaoOrcamento(limites, realizado).map((linha) => ({
        ...linha,
        origem: origemPorCategoria.get(linha.categoriaId) ?? 'global'
      }))
    }
  )
}
