import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { Database } from '../src/persistence/database'
import { openDatabase } from '../src/persistence/database'
import { runMigrations } from '../src/persistence/migrations/runner'
import { registerCartaoHandlers } from './ipc/cartao-handlers'
import { registerCategoriaHandlers } from './ipc/categoria-handlers'
import { registerDespesaHandlers } from './ipc/despesa-handlers'
import { registerFaturaHandlers } from './ipc/fatura-handlers'
import { registerRendaHandlers } from './ipc/renda-handlers'
import { registerRecebimentoHandlers } from './ipc/recebimento-handlers'
import { registerVisaoMensalHandlers } from './ipc/visao-mensal-handlers'
import { registerRelatorioHandlers } from './ipc/relatorio-handlers'

let db: Database | null = null
let isShuttingDown = false

// TALLY_USER_DATA permite redirecionar o diretório de dados para uma pasta
// isolada — usado pelos testes E2E para nunca tocar na base real do usuário.
function resolveDbPath(): string {
  const override = process.env.TALLY_USER_DATA
  if (override) {
    app.setPath('userData', override)
  }
  const userDataDir = override ?? app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  return join(userDataDir, 'tally.db')
}

// node-sqlite3-wasm usa o diretório `<db>.lock` como primitiva de lock.
// Se um processo anterior morrer sem chamar db.close(), o diretório fica
// órfão e o próximo boot falha com "database is locked". Como já garantimos
// single-instance via requestSingleInstanceLock(), qualquer .lock encontrado
// aqui é necessariamente lixo de uma execução anterior.
function limparLockOrfao(dbPath: string): void {
  const lockPath = `${dbPath}.lock`
  if (!existsSync(lockPath)) return
  try {
    rmSync(lockPath, { recursive: true, force: true })
    if (is.dev) {
      console.warn(`[db] lock órfão removido: ${lockPath} (shutdown sujo anterior?)`)
    }
  } catch (err) {
    console.error(`[db] falha ao remover lock órfão em ${lockPath}:`, err)
    throw err
  }
}

function inicializarBancoDeDados(): Database {
  const dbPath = resolveDbPath()
  limparLockOrfao(dbPath)
  const database = openDatabase(dbPath)
  const result = runMigrations(database)
  if (is.dev && result.applied.length > 0) {
    console.log(`[migrations] aplicadas: ${result.applied.join(', ')}`)
  }
  return database
}

function fecharBanco(): void {
  if (!db) return
  try {
    db.close()
  } catch (err) {
    console.error('[db] erro ao fechar conexão:', err)
  } finally {
    db = null
  }
}

function encerrarComFalha(motivo: string, err: unknown): never {
  console.error(`[main] ${motivo}:`, err)
  if (is.dev) {
    const mensagem = err instanceof Error ? err.message : String(err)
    try {
      dialog.showErrorBox('Erro ao inicializar o Tally', `${motivo}\n\n${mensagem}`)
    } catch {
      // dialog pode não estar disponível antes do ready; ignorar.
    }
  }
  fecharBanco()
  app.exit(1)
  throw new Error('unreachable')
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

const obteveLock = app.requestSingleInstanceLock()
if (!obteveLock) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    const [first] = BrowserWindow.getAllWindows()
    if (!first) return
    if (first.isMinimized()) first.restore()
    first.focus()
  })

  app.whenReady().then(() => {
    try {
      db = inicializarBancoDeDados()
      registerCartaoHandlers(db, ipcMain)
      registerCategoriaHandlers(db, ipcMain)
      registerDespesaHandlers(db, ipcMain)
      registerFaturaHandlers(db, ipcMain)
      registerRendaHandlers(db, ipcMain)
      registerRecebimentoHandlers(db, ipcMain)
      registerVisaoMensalHandlers(db, ipcMain)
      registerRelatorioHandlers(db, ipcMain)
      createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    } catch (err) {
      encerrarComFalha('Falha ao inicializar o app', err)
    }
  })

  app.on('before-quit', () => {
    isShuttingDown = true
    fecharBanco()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  const onSignal = (sinal: NodeJS.Signals): void => {
    if (isShuttingDown) return
    isShuttingDown = true
    if (is.dev) console.log(`[main] recebido ${sinal}, encerrando.`)
    fecharBanco()
    app.exit(0)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  process.on('SIGHUP', onSignal)

  process.on('uncaughtException', (err) => {
    if (isShuttingDown) return
    encerrarComFalha('uncaughtException', err)
  })
  process.on('unhandledRejection', (reason) => {
    if (isShuttingDown) return
    encerrarComFalha('unhandledRejection', reason)
  })
}
