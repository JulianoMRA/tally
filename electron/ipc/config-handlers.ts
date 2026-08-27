import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dialog, shell, type BrowserWindow, type IpcMain } from 'electron'
import { backupDatabase, listarBackups } from '../../src/persistence/backup'
import { lerConfig, gravarConfig } from '../../src/persistence/settings'
import {
  configSchema,
  restaurarBackupInputSchema,
  temaSchema,
  CONFIG_IPC_CHANNELS
} from '../../src/shared/ipc/config'
import { TEMA_IPC_CHANNELS } from '../../src/shared/ipc/channels'

type JanelaAtual = () => BrowserWindow | undefined

/**
 * `restaurarBackup` troca o arquivo do banco embaixo de uma conexão aberta,
 * então o main injeta como fechar e reabrir o SQLite. Sem isso o `copyFileSync`
 * sobrescreveria um arquivo em uso.
 */
type ControleDoBanco = {
  caminhoDoBanco: () => string | null
  fechar: () => void
  reabrir: () => void
}

export function registerConfigHandlers(
  settingsPath: string,
  ipcMain: IpcMain,
  janelaAtual: JanelaAtual,
  banco: ControleDoBanco
): void {
  function pastaDeBackups(dbPath: string): string {
    return lerConfig(settingsPath).backupsDir ?? join(dirname(dbPath), 'backups')
  }

  ipcMain.handle(CONFIG_IPC_CHANNELS.get, () => lerConfig(settingsPath))

  // `on` + `returnValue`, nao `handle`: o preload chama isto de forma sincrona
  // para carimbar o tema no <html> antes de a pagina pintar. Ver o comentario
  // em `carimbarTemaInicial`.
  ipcMain.on(TEMA_IPC_CHANNELS.inicialSync, (event) => {
    event.returnValue = lerConfig(settingsPath).tema
  })

  // Grava so o tema, preservando o resto. `config:set` exigiria o objeto
  // inteiro, e o renderer teria de ler antes de escrever — uma corrida com
  // qualquer outra tela que estivesse salvando ajustes ao mesmo tempo.
  ipcMain.handle(TEMA_IPC_CHANNELS.definir, (_event, payload: unknown) => {
    const tema = temaSchema.parse(payload)
    gravarConfig(settingsPath, { ...lerConfig(settingsPath), tema })
    return tema
  })

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

  ipcMain.handle(CONFIG_IPC_CHANNELS.listarBackups, () => {
    const dbPath = banco.caminhoDoBanco()
    if (!dbPath) return []
    return listarBackups(dbPath, pastaDeBackups(dbPath))
  })

  ipcMain.handle(CONFIG_IPC_CHANNELS.criarBackupAgora, () => {
    const dbPath = banco.caminhoDoBanco()
    if (!dbPath) throw new Error('Banco de dados não inicializado')
    const dir = pastaDeBackups(dbPath)
    // Fecha e reabre em volta da cópia: copiar um SQLite em uso pode capturar
    // um journal a meio caminho.
    banco.fechar()
    try {
      backupDatabase(dbPath, {
        backupsDir: dir,
        maxBackups: lerConfig(settingsPath).retencaoBackups
      })
    } finally {
      banco.reabrir()
    }
    return listarBackups(dbPath, dir)
  })

  ipcMain.handle(CONFIG_IPC_CHANNELS.abrirPastaBackups, async () => {
    const dbPath = banco.caminhoDoBanco()
    if (!dbPath) return
    await shell.openPath(pastaDeBackups(dbPath))
  })

  ipcMain.handle(CONFIG_IPC_CHANNELS.restaurarBackup, (_event, payload: unknown) => {
    const { caminho } = restaurarBackupInputSchema.parse(payload)
    const dbPath = banco.caminhoDoBanco()
    if (!dbPath) throw new Error('Banco de dados não inicializado')
    if (!existsSync(caminho)) throw new Error('Cópia de backup não encontrada')

    // O estado atual vira um backup antes de ser sobrescrito: restaurar por
    // engano não pode ser um caminho sem volta.
    backupDatabase(dbPath, {
      backupsDir: pastaDeBackups(dbPath),
      maxBackups: lerConfig(settingsPath).retencaoBackups
    })

    banco.fechar()
    try {
      copyFileSync(caminho, dbPath)
    } finally {
      banco.reabrir()
    }

    janelaAtual()?.webContents.reload()
  })
}
