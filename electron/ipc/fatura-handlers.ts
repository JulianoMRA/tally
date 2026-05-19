import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { FaturaRepository } from '../../src/persistence/repositories/fatura-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import { AjudaRepository } from '../../src/persistence/repositories/ajuda-repository'
import { fecharFatura, pagarFatura, reabrirFatura } from '../../src/domain/services/ciclo-fatura'
import { FATURA_IPC_CHANNELS } from '../../src/shared/ipc/fatura'
import type { FaturaDetalhada } from '../../src/shared/ipc/fatura'

export function registerFaturaHandlers(db: Database, ipcMain: IpcMain): void {
  const faturaRepo = new FaturaRepository(db)
  const parcelaRepo = new ParcelaRepository(db)
  const ajudaRepo = new AjudaRepository(db)

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
      const { totalAjudasCentavos } = ajudaRepo.totaisPorFatura(faturaId)
      const totalLiquidoCentavos = totalBrutoCentavos - totalAjudasCentavos

      return {
        fatura,
        parcelas,
        totalBrutoCentavos,
        totalAjudasCentavos,
        totalLiquidoCentavos
      }
    }
  )

  ipcMain.handle(FATURA_IPC_CHANNELS.fechar, (_event, faturaId: number) => {
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = fecharFatura(fatura)
    if (!resultado.ok) throw new Error(resultado.erro)
    return faturaRepo.fechar(faturaId)
  })

  ipcMain.handle(FATURA_IPC_CHANNELS.pagar, (_event, faturaId: number, dataPagamento: string) => {
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = pagarFatura(fatura, dataPagamento)
    if (!resultado.ok) throw new Error(resultado.erro)
    return faturaRepo.pagar(faturaId, dataPagamento)
  })

  ipcMain.handle(FATURA_IPC_CHANNELS.reabrir, (_event, faturaId: number) => {
    const fatura = faturaRepo.findById(faturaId)
    if (!fatura) throw new Error(`Fatura #${faturaId} não encontrada`)
    const resultado = reabrirFatura(fatura)
    if (!resultado.ok) throw new Error(resultado.erro)
    return faturaRepo.reabrir(faturaId)
  })
}
