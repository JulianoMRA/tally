import type { IpcMain } from 'electron'
import type { Database } from '../../src/persistence/database'
import { DespesaRepository } from '../../src/persistence/repositories/despesa-repository'
import { ParcelaRepository } from '../../src/persistence/repositories/parcela-repository'
import {
  despesaUnicaCreditoInputSchema,
  despesaParceladaCreditoInputSchema,
  despesaEmAndamentoInputSchema,
  despesaAssinaturaCreditoInputSchema,
  cancelarAssinaturaInputSchema,
  reajustarAssinaturaInputSchema,
  listarAssinaturasInputSchema,
  adiantarParcelasInputSchema,
  cancelarPendentesInputSchema,
  despesaUnicaForaCartaoInputSchema,
  listarGastosForaCartaoInputSchema,
  excluirDespesaInputSchema,
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

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarAssinaturaCredito, (_event, payload: unknown) => {
    const input = despesaAssinaturaCreditoInputSchema.parse(payload)
    return repo.criarAssinaturaCredito(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.cancelarAssinatura, (_event, payload: unknown) => {
    const { despesaId } = cancelarAssinaturaInputSchema.parse(payload)
    return repo.cancelarAssinatura(despesaId)
  })

  ipcMain.handle(
    DESPESA_IPC_CHANNELS.reajustarValorMensalAssinatura,
    (_event, payload: unknown) => {
      const { despesaId, novoValorCentavos } = reajustarAssinaturaInputSchema.parse(payload)
      return repo.reajustarValorMensalAssinatura(despesaId, novoValorCentavos)
    }
  )

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarAssinaturas, (_event, payload: unknown) => {
    const filtro = listarAssinaturasInputSchema.parse(payload ?? {})
    return repo.listarAssinaturas(filtro)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.criarUnicaForaCartao, (_event, payload: unknown) => {
    const input = despesaUnicaForaCartaoInputSchema.parse(payload)
    return repo.criarUnicaForaCartao(input)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.listarGastosForaCartao, (_event, payload: unknown) => {
    const filtro = listarGastosForaCartaoInputSchema.parse(payload ?? {})
    return repo.listarGastosForaCartao(filtro)
  })

  ipcMain.handle(DESPESA_IPC_CHANNELS.excluir, (_event, payload: unknown) => {
    const { despesaId } = excluirDespesaInputSchema.parse(payload)
    return repo.excluir(despesaId)
  })
}
