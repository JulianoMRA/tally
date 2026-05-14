import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type Database from 'better-sqlite3'
import { openDatabase } from '../src/persistence/database'
import { runMigrations } from '../src/persistence/migrations/runner'
import { registerCartaoHandlers } from './ipc/cartao-handlers'
import { registerCategoriaHandlers } from './ipc/categoria-handlers'

let db: Database.Database | null = null

function inicializarBancoDeDados(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'tally.db')
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
