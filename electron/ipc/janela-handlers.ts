import type { BrowserWindow, IpcMain } from 'electron'
import { JANELA_IPC_CHANNELS } from '../../src/shared/ipc/channels'

type JanelaAtual = () => BrowserWindow | undefined

/**
 * Controles de janela para a barra de título própria.
 *
 * Nenhum handler recebe argumento, então não há schema a validar — o que chega
 * do renderer é só o disparo. `mudouEstado` é o caminho inverso: o main avisa a
 * janela sempre que ela é maximizada ou restaurada, inclusive quando isso vem
 * do sistema (duplo-clique na barra, Win+Seta, encostar na borda).
 */
export function registerJanelaHandlers(ipcMain: IpcMain, janelaAtual: JanelaAtual): void {
  ipcMain.handle(JANELA_IPC_CHANNELS.minimizar, () => janelaAtual()?.minimize())
  ipcMain.handle(JANELA_IPC_CHANNELS.alternarMaximizada, () => {
    const win = janelaAtual()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(JANELA_IPC_CHANNELS.fechar, () => janelaAtual()?.close())
  ipcMain.handle(JANELA_IPC_CHANNELS.estaMaximizada, () => janelaAtual()?.isMaximized() ?? false)
}

/**
 * Liga os eventos da janela ao canal `mudouEstado`. Chamado na criação da
 * janela, não no registro dos handlers, porque depende desta instância.
 */
export function observarEstadoDaJanela(win: BrowserWindow): void {
  const avisar = () => {
    if (!win.isDestroyed()) {
      win.webContents.send(JANELA_IPC_CHANNELS.mudouEstado, win.isMaximized())
    }
  }
  win.on('maximize', avisar)
  win.on('unmaximize', avisar)
}
