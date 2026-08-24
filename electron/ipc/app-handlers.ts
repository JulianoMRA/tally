import type { IpcMain } from 'electron'
import { APP_IPC_CHANNELS } from '../../src/shared/ipc/app'

type AcoesDoApp = {
  exportarDados: () => Promise<void>
  importarDados: () => Promise<void>
  verificarAtualizacoes: () => Promise<void>
  sair: () => void
}

/**
 * Expõe ao renderer as ações que viviam no menu nativo "Arquivo".
 *
 * As implementações continuam no `main.ts` — este módulo só as pluga no IPC.
 * Nenhuma recebe argumento, então não há schema a validar: o que chega do
 * renderer é apenas o disparo.
 */
export function registerAppHandlers(ipcMain: IpcMain, acoes: AcoesDoApp): void {
  ipcMain.handle(APP_IPC_CHANNELS.exportarDados, () => acoes.exportarDados())
  ipcMain.handle(APP_IPC_CHANNELS.importarDados, () => acoes.importarDados())
  ipcMain.handle(APP_IPC_CHANNELS.verificarAtualizacoes, () => acoes.verificarAtualizacoes())
  ipcMain.handle(APP_IPC_CHANNELS.sair, () => acoes.sair())
}
