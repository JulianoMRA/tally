import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { Database } from '../src/persistence/database'
import { openDatabase } from '../src/persistence/database'
import { runMigrations } from '../src/persistence/migrations/runner'
import { registerCartaoHandlers } from './ipc/cartao-handlers'
import { registerCategoriaHandlers } from './ipc/categoria-handlers'
import { registerDespesaHandlers } from './ipc/despesa-handlers'
import { registerFaturaHandlers } from './ipc/fatura-handlers'

let db: Database | null = null

function inicializarBancoDeDados(): Database {
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  const dbPath = join(userDataDir, 'tally.db')
  const database = openDatabase(dbPath)
  const result = runMigrations(database)
  if (result.applied.length > 0) {
    console.log(`[migrations] aplicadas: ${result.applied.join(', ')}`)
  }
  return database
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Tally',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  db = inicializarBancoDeDados()
  registerCartaoHandlers(db, ipcMain)
  registerCategoriaHandlers(db, ipcMain)
  registerDespesaHandlers(db, ipcMain)
  registerFaturaHandlers(db, ipcMain)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  db?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
