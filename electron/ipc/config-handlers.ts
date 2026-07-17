import { dialog, type BrowserWindow, type IpcMain } from 'electron'
import { lerConfig, gravarConfig } from '../../src/persistence/settings'
import { configSchema, CONFIG_IPC_CHANNELS } from '../../src/shared/ipc/config'

type JanelaAtual = () => BrowserWindow | undefined

export function registerConfigHandlers(
  settingsPath: string,
  ipcMain: IpcMain,
  janelaAtual: JanelaAtual
): void {
  ipcMain.handle(CONFIG_IPC_CHANNELS.get, () => lerConfig(settingsPath))

  ipcMain.handle(CONFIG_IPC_CHANNELS.set, (_event, payload: unknown) => {
    const config = configSchema.parse(payload)
    return gravarConfig(settingsPath, config)
  })

  ipcMain.handle(CONFIG_IPC_CHANNELS.escolherPastaBackup, async () => {
    const win = janelaAtual()
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Escolher pasta de backups',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
}
