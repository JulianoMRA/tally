import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { is } from '@electron-toolkit/utils'
// electron-updater e CJS; o default import + destructuring e o padrao seguro
// para o bundle CJS do electron-vite (named import quebra o interop).
import electronUpdater from 'electron-updater'
import type { Database } from '../src/persistence/database'
import { openDatabase } from '../src/persistence/database'
import { backupDatabase, type BackupOptions } from '../src/persistence/backup'
import { lerConfig } from '../src/persistence/settings'
import { runMigrations } from '../src/persistence/migrations/runner'
import { DadosRepository } from '../src/persistence/repositories/dados-repository'
import { exportPayloadSchema } from '../src/shared/ipc/dados'
import { hojeIsoLocal } from '../src/shared/datas-locais'
import { FaturaRepository } from '../src/persistence/repositories/fatura-repository'
import { registerCartaoHandlers } from './ipc/cartao-handlers'
import { registerCategoriaHandlers } from './ipc/categoria-handlers'
import { registerDespesaHandlers } from './ipc/despesa-handlers'
import { registerFaturaHandlers } from './ipc/fatura-handlers'
import { registerRendaHandlers } from './ipc/renda-handlers'
import { registerRecebimentoHandlers } from './ipc/recebimento-handlers'
import { registerVisaoMensalHandlers } from './ipc/visao-mensal-handlers'
import { registerRelatorioHandlers } from './ipc/relatorio-handlers'
import { registerOrcamentoHandlers } from './ipc/orcamento-handlers'
import { registerConfigHandlers } from './ipc/config-handlers'

let db: Database | null = null
let mainWindow: BrowserWindow | null = null
let dbPathAtual: string | null = null
let isShuttingDown = false
let fechamentoTimer: NodeJS.Timeout | null = null

// RN-06: além do boot e da visão mensal, faturas vencidas precisam fechar em
// sessões longas (app aberto virando o dia). Timer horário cobre esse caso.
const FECHAMENTO_INTERVALO_MS = 60 * 60 * 1000

function iniciarTimerFechamento(database: Database): void {
  fechamentoTimer = setInterval(() => {
    try {
      const fechadas = new FaturaRepository(database).fecharVencidas(hojeIsoLocal())
      if (is.dev && fechadas > 0) {
        console.log(`[faturas] timer: ${fechadas} fatura(s) Aberta vencidas → Fechada`)
      }
    } catch (err) {
      console.error('[faturas] timer de fechamento falhou:', err)
    }
  }, FECHAMENTO_INTERVALO_MS)
}

// TALLY_USER_DATA permite redirecionar o diretório de dados para uma pasta
// isolada — usado pelos testes E2E para nunca tocar na base real do usuário.
// Aplicado no topo do módulo, ANTES do requestSingleInstanceLock: o lock do
// Electron é por diretório userData, então instâncias E2E (cada uma com seu
// diretório isolado) não competem entre si nem com o app real — pré-requisito
// para specs Playwright em paralelo.
const userDataOverride = process.env.TALLY_USER_DATA
if (userDataOverride) {
  app.setPath('userData', userDataOverride)
}

function resolveDbPath(): string {
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  return join(userDataDir, 'tally.db')
}

function resolveSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Opcoes de backup derivadas da configuracao do usuario (pasta + retencao). */
function opcoesDeBackup(): BackupOptions {
  const config = lerConfig(resolveSettingsPath())
  return {
    backupsDir: config.backupsDir ?? undefined,
    maxBackups: config.retencaoBackups
  }
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
  dbPathAtual = dbPath
  limparLockOrfao(dbPath)
  // Copia de seguranca do arquivo ANTES de abrir/migrar: se uma migration
  // corromper o schema, o estado pre-migration fica preservado em backups/.
  const backupPath = backupDatabase(dbPath, opcoesDeBackup())
  if (is.dev && backupPath) {
    console.log(`[db] backup criado: ${backupPath}`)
  }
  const database = openDatabase(dbPath)
  const result = runMigrations(database)
  if (is.dev && result.applied.length > 0) {
    console.log(`[migrations] aplicadas: ${result.applied.join(', ')}`)
  }
  // RN-06: auto-fechamento de faturas vencidas no boot. Antes vivia em
  // FaturaRepository.list (mutate-on-read); foi extraido para cá para que
  // SELECTs nunca disparem UPDATEs como efeito colateral. Data LOCAL — com
  // toISOString (UTC) faturas fechavam ate 3h mais cedo em UTC-3.
  const fechadas = new FaturaRepository(database).fecharVencidas(hojeIsoLocal())
  if (is.dev && fechadas > 0) {
    console.log(`[faturas] ${fechadas} fatura(s) Aberta vencidas → Fechada`)
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

// Mostra o diálogo também em produção: sem ele, uma falha de boot (migration,
// banco corrompido) fechava o app silenciosamente, sem qualquer pista ao usuário.
function encerrarComFalha(motivo: string, err: unknown): never {
  console.error(`[main] ${motivo}:`, err)
  const mensagem = err instanceof Error ? err.message : String(err)
  try {
    dialog.showErrorBox('Erro ao inicializar o Tally', `${motivo}\n\n${mensagem}`)
  } catch {
    // dialog pode não estar disponível antes do ready; ignorar.
  }
  fecharBanco()
  app.exit(1)
  throw new Error('unreachable')
}

// Content-Security-Policy aplicada no renderer.
// 'unsafe-inline' em style-src é exigido pelo emit do Vite (CSS Modules + recharts inline styles).
// Em dev, 'unsafe-eval' adicional para HMR do Vite; em produção, política mais estrita.
function cspHeader(): string {
  if (is.dev) {
    // Dev: Vite HMR injeta inline scripts (preamble do @vitejs/plugin-react)
    // e usa eval para hot-update. unsafe-inline + unsafe-eval necessarios.
    // ws:/wss: para o websocket do HMR.
    return (
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' ws: wss: http://localhost:*; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'none'"
    )
  }
  return (
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'none'"
  )
}

// CSP aplicada apenas em dev (renderer via http://localhost). Em producao o
// renderer carrega via file:// onde 'self' e ambiguo no Electron — scripts
// legítimos podem ser bloqueados. Producao ja esta protegida por
// contextIsolation + nodeIntegration: false + webSecurity: true.
function instalarCSP(): void {
  if (!is.dev) return
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader()]
      }
    })
  })
}

// Abre uma URL no navegador externo apenas se for http(s) bem-formada.
// new URL() rejeita strings malformadas e a checagem exata de protocolo evita
// esquemas perigosos (file:, javascript:, etc.) que um startsWith deixaria passar.
function abrirExternoSeguro(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    shell.openExternal(parsed.href)
  }
}

function janelaAtual(): BrowserWindow | undefined {
  return mainWindow ?? BrowserWindow.getAllWindows()[0]
}

const { autoUpdater } = electronUpdater

// O launcher portable do electron-builder seta esta env; o binario portable
// nao tem instalador substituivel, entao auto-update fica desabilitado nele.
function ehPortable(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
}

function iniciarAutoUpdate(): void {
  if (!app.isPackaged || ehPortable()) return
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // Sem rede ou release indisponivel nao e erro fatal — apenas loga.
    console.error('[updater] checagem automatica falhou:', err)
  })
}

async function verificarAtualizacoesManual(): Promise<void> {
  const win = janelaAtual()
  if (!win) return
  if (!app.isPackaged) {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Atualizações',
      message: 'Checagem de atualização indisponível em desenvolvimento.'
    })
    return
  }
  if (ehPortable()) {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Atualizações',
      message: 'A versão portable não atualiza automaticamente.',
      detail: 'Baixe a versão mais recente em github.com/JulianoMRA/tally/releases.'
    })
    return
  }
  try {
    const resultado = await autoUpdater.checkForUpdates()
    const novaVersao = resultado?.updateInfo.version
    if (novaVersao && novaVersao !== app.getVersion()) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Atualização disponível',
        message: `Versão ${novaVersao} disponível (atual: ${app.getVersion()}).`,
        detail: 'O download acontece em segundo plano e a atualização é aplicada ao fechar o app.'
      })
    } else {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Atualizações',
        message: `Você já está na versão mais recente (${app.getVersion()}).`
      })
    }
  } catch (err) {
    dialog.showErrorBox(
      'Falha ao checar atualizações',
      err instanceof Error ? err.message : String(err)
    )
  }
}

async function exportarDados(): Promise<void> {
  if (!db) return
  const win = janelaAtual()
  if (!win) return
  const padrao = `tally-export-${hojeIsoLocal()}.json`
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar dados do Tally',
    defaultPath: padrao,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return
  try {
    const payload = new DadosRepository(db).exportar()
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Exportação concluída',
      message: 'Dados exportados com sucesso.',
      detail: filePath
    })
  } catch (err) {
    dialog.showErrorBox('Falha ao exportar', err instanceof Error ? err.message : String(err))
  }
}

async function importarDados(): Promise<void> {
  if (!db || !dbPathAtual) return
  const win = janelaAtual()
  if (!win) return
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Importar dados para o Tally',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || filePaths.length === 0) return

  const confirma = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancelar', 'Importar e substituir'],
    defaultId: 0,
    cancelId: 0,
    title: 'Substituir todos os dados?',
    message: 'A importação substitui TODOS os dados atuais pelos do arquivo.',
    detail: 'Um backup automático do estado atual é criado antes. Deseja continuar?'
  })
  if (confirma.response !== 1) return

  try {
    const conteudo = readFileSync(filePaths[0], 'utf8')
    const payload = exportPayloadSchema.parse(JSON.parse(conteudo))
    backupDatabase(dbPathAtual)
    const { totalLinhas } = new DadosRepository(db).importar(payload)
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Importação concluída',
      message: `${totalLinhas} registro(s) importado(s). A janela será recarregada.`
    })
    mainWindow?.webContents.reload()
  } catch (err) {
    dialog.showErrorBox('Falha ao importar', err instanceof Error ? err.message : String(err))
  }
}

function construirMenuApp(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Exportar dados…', click: () => void exportarDados() },
        { label: 'Importar dados…', click: () => void importarDados() },
        { type: 'separator' },
        { label: 'Verificar atualizações…', click: () => void verificarAtualizacoesManual() },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' }
      ]
    }
  ]
  if (is.dev) {
    template.push({
      label: 'Desenvolvimento',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }]
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Tally',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true — o preload importa apenas constantes de canal do módulo
      // zero-zod (@shared/ipc/channels) e tipos (apagados em compile), então seu
      // bundle não arrasta zod nem precisa de require() proibido no sandbox. Toda
      // validação Zod já vive nos handlers do main, não no preload.
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })

  // window.open() abre no navegador externo do SO, nunca em uma nova janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    abrirExternoSeguro(url)
    return { action: 'deny' }
  })

  // Bloqueia navegação para fora do app (preserva apenas o renderer atual).
  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    const ehInterno =
      (rendererUrl && url.startsWith(rendererUrl)) ||
      url.startsWith('file://') ||
      url.startsWith(win.webContents.getURL())
    if (!ehInterno) {
      event.preventDefault()
      abrirExternoSeguro(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
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
      instalarCSP()
      db = inicializarBancoDeDados()
      registerCartaoHandlers(db, ipcMain)
      registerCategoriaHandlers(db, ipcMain)
      registerDespesaHandlers(db, ipcMain)
      registerFaturaHandlers(db, ipcMain)
      registerRendaHandlers(db, ipcMain)
      registerRecebimentoHandlers(db, ipcMain)
      registerVisaoMensalHandlers(db, ipcMain)
      registerRelatorioHandlers(db, ipcMain)
      registerOrcamentoHandlers(db, ipcMain)
      registerConfigHandlers(resolveSettingsPath(), ipcMain, janelaAtual)
      construirMenuApp()
      createWindow()
      iniciarTimerFechamento(db)
      iniciarAutoUpdate()

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
    if (fechamentoTimer) {
      clearInterval(fechamentoTimer)
      fechamentoTimer = null
    }
    // Backup DEPOIS de fechar a conexão: o arquivo copiado fica sempre em
    // estado consistente (sem journal pendente de escrita em andamento).
    fecharBanco()
    if (dbPathAtual && lerConfig(resolveSettingsPath()).backupAoSair) {
      try {
        backupDatabase(dbPathAtual, opcoesDeBackup())
      } catch (err) {
        console.error('[backup] falha no backup ao sair:', err)
      }
    }
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
