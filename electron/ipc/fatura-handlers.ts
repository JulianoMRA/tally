import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { FaturaRepository } from '../../src/persistence/repositories/fatura-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import { FATURA_IPC_CHANNELS } from '../../src/shared/ipc/fatura'
import type { FaturaDetalhada } from '../../src/shared/ipc/fatura'

export function registerFaturaHandlers(db: Database, ipcMain: IpcMain): void {
  const faturaRepo = new FaturaRepository(db)
  const parcelaRepo = new ParcelaRepository(db)

  ipcMain.handle(FATURA_IPC_CHANNELS.listarPorCartao, (_event, cartaoId: number) => {
    return faturaRepo.list(cartaoId)
  })

  ipcMain.handle(
    FATURA_IPC_CHANNELS.detalharComParcelas,
    (_event, faturaId: number): FaturaDetalhada | null => {
      const fatura = faturaRepo.findById(faturaId)
      if (!fatura) return null

      const parcelas = parcelaRepo.listarPorFatura(faturaId)
      const totalBrutoCentavos = parcelas.reduce((sum, p) => sum + p.valorCentavos, 0)

      return { fatura, parcelas, totalBrutoCentavos }
    }
  )
}
