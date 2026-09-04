import type { IpcMain } from 'electron'
import { obterSimulacaoDoMes, salvarSimulacaoDoMes } from '../../src/persistence/simulacoes'
import type { SimulacaoDoMes } from '../../src/domain/entities/simulacao'
import {
  obterSimulacaoInputSchema,
  salvarSimulacaoInputSchema,
  SIMULACAO_IPC_CHANNELS
} from '../../src/shared/ipc/simulacao'

/**
 * Handlers da simulação (RF-SIM). Não recebem conexão de banco: a simulação
 * mora num JSON próprio, e este é o único par de canais do app que não toca o
 * SQLite. Um erro aqui não tem como corromper dado financeiro.
 */
export function registerSimulacaoHandlers(caminhoSimulacoes: string, ipcMain: IpcMain): void {
  ipcMain.handle(SIMULACAO_IPC_CHANNELS.obter, (_event, payload: unknown): SimulacaoDoMes => {
    const { mesReferencia } = obterSimulacaoInputSchema.parse(payload)
    return obterSimulacaoDoMes(caminhoSimulacoes, mesReferencia)
  })

  ipcMain.handle(SIMULACAO_IPC_CHANNELS.salvar, (_event, payload: unknown): SimulacaoDoMes => {
    const { mesReferencia, simulacao } = salvarSimulacaoInputSchema.parse(payload)
    return salvarSimulacaoDoMes(caminhoSimulacoes, mesReferencia, simulacao)
  })
}
