import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { openDatabase } from '../src/persistence/database'
import { runMigrations } from '../src/persistence/migrations/runner'

function inicializarBancoDeDados(): void {
  const dbPath = join(app.getPath('userData'), 'tally.db')
  const db = openDatabase(dbPath)
  try {
    const result = runMigrations(db)
    if (result.applied.length > 0) {
      console.log(`[migrations] aplicadas: ${result.applied.join(', ')}`)
    }
  } finally {
    db.close()
  }
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
  inicializarBancoDeDados()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
