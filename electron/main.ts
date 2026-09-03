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
import { ehDev } from './ambiente'
// electron-updater e CJS; o default import + destructuring e o padrao seguro
// para o bundle CJS do electron-vite (named import quebra o interop).
import electronUpdater from 'electron-updater'
import log from 'electron-log/main'
import type { Database } from '../src/persistence/database'
import { openDatabase } from '../src/persistence/database'
import { backupDatabase, type BackupOptions } from '../src/persistence/backup'
import { lerConfig } from '../src/persistence/settings'
import { COR_DE_FUNDO_POR_TEMA } from '../src/shared/ipc/config'
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
import { registerAppHandlers } from './ipc/app-handlers'
import { registerJanelaHandlers, observarEstadoDaJanela } from './ipc/janela-handlers'
import { registerDadosHandlers } from './ipc/dados-handlers'
import { verificarAvisos } from './avisos'
import { ehNavegacaoInterna, urlExternaPermitida } from './navegacao'
import {
  CARTAO_IPC_CHANNELS,
  CATEGORIA_IPC_CHANNELS,
  DADOS_IPC_CHANNELS,
  DESPESA_IPC_CHANNELS,
  FATURA_IPC_CHANNELS,
  ORCAMENTO_IPC_CHANNELS,
  RECEBIMENTO_IPC_CHANNELS,
  RELATORIO_IPC_CHANNELS,
  RENDA_IPC_CHANNELS,
  VISAO_MENSAL_IPC_CHANNELS
} from '../src/shared/ipc/channels'

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
      if (ehDev() && fechadas > 0) {
        console.log(`[faturas] timer: ${fechadas} fatura(s) Aberta vencidas → Fechada`)
      }
      verificarAvisos(database, resolveSettingsPath())
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

// Log em arquivo do main process, em `<userData>/logs/main.log`. Precisa vir
// DEPOIS do override acima, senão o E2E escreveria no log do app real.
//
// Existe por causa de uma falha concreta: quando o repositório ficou privado, a
// checagem de atualização passou a receber 404 e o app instalado parou de
// atualizar **em silêncio** — o catch do boot só fazia `console.error`, e
// binário empacotado não tem console para onde escrever. A falha só apareceu
// comparando o cache do updater na mão. Com o log, o próximo 404 fica gravado.
log.initialize()
log.transports.file.level = 'info'

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
    if (ehDev()) {
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
  if (ehDev() && backupPath) {
    console.log(`[db] backup criado: ${backupPath}`)
  }
  const database = openDatabase(dbPath)
  const result = runMigrations(database)
  if (ehDev() && result.applied.length > 0) {
    console.log(`[migrations] aplicadas: ${result.applied.join(', ')}`)
  }
  // RN-06: auto-fechamento de faturas vencidas no boot. Antes vivia em
  // FaturaRepository.list (mutate-on-read); foi extraido para cá para que
  // SELECTs nunca disparem UPDATEs como efeito colateral. Data LOCAL — com
  // toISOString (UTC) faturas fechavam ate 3h mais cedo em UTC-3.
  const fechadas = new FaturaRepository(database).fecharVencidas(hojeIsoLocal())
  if (ehDev() && fechadas > 0) {
    console.log(`[faturas] ${fechadas} fatura(s) Aberta vencidas → Fechada`)
  }
  return database
}

/**
 * Registra (ou re-registra) todos os handlers que dependem do banco.
 *
 * Os handlers capturam a instância de `Database` no closure, então trocar o
 * arquivo — o que a restauração de backup faz — exige recriá-los apontando para
 * a conexão nova. `removeHandler` antes, senão o Electron recusa o segundo
 * `handle` no mesmo canal. Os handlers de config ficam de fora de propósito:
 * eles não dependem do banco e são quem dispara a restauração.
 */
function reregistrarHandlersDeDados(database: Database): void {
  const grupos = [
    CARTAO_IPC_CHANNELS,
    CATEGORIA_IPC_CHANNELS,
    DESPESA_IPC_CHANNELS,
    FATURA_IPC_CHANNELS,
    RENDA_IPC_CHANNELS,
    RECEBIMENTO_IPC_CHANNELS,
    VISAO_MENSAL_IPC_CHANNELS,
    RELATORIO_IPC_CHANNELS,
    ORCAMENTO_IPC_CHANNELS,
    DADOS_IPC_CHANNELS
  ]
  for (const grupo of grupos) {
    for (const canal of Object.values(grupo)) ipcMain.removeHandler(canal)
  }

  registerCartaoHandlers(database, ipcMain)
  registerCategoriaHandlers(database, ipcMain)
  registerDespesaHandlers(database, ipcMain)
  registerFaturaHandlers(database, ipcMain)
  registerRendaHandlers(database, ipcMain)
  registerRecebimentoHandlers(database, ipcMain)
  registerVisaoMensalHandlers(database, ipcMain)
  registerRelatorioHandlers(database, ipcMain)
  registerOrcamentoHandlers(database, ipcMain)
  registerDadosHandlers(database, ipcMain, janelaAtual)
}

/**
 * Reabre a conexão e reinstala os handlers sobre o banco novo. Usado pela
 * restauração de backup, que troca o arquivo embaixo da conexão aberta.
 */
function reabrirBanco(): void {
  if (!dbPathAtual) throw new Error('Sem caminho de banco para reabrir')
  // Mesmo tratamento do boot: o node-sqlite3-wasm usa `<db>.lock` como
  // primitiva e o diretório sobrevive ao close, então reabrir sem limpar dava
  // "database is locked". Aqui o lock é comprovadamente nosso — acabamos de
  // fechar a conexão duas linhas acima de quem chama.
  limparLockOrfao(dbPathAtual)
  db = openDatabase(dbPathAtual)
  runMigrations(db)
  reregistrarHandlersDeDados(db)
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
  if (ehDev()) {
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
  if (!ehDev()) return
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
// A decisao vive em `navegacao.ts`, sem dependencia de electron, para ter teste.
function abrirExternoSeguro(rawUrl: string): void {
  const permitida = urlExternaPermitida(rawUrl)
  if (permitida) shell.openExternal(permitida)
}

function janelaAtual(): BrowserWindow | undefined {
  return mainWindow ?? BrowserWindow.getAllWindows()[0]
}

const { autoUpdater } = electronUpdater

// O logger do electron-updater é verboso por natureza (versão encontrada, URL
// consultada, progresso do download) — é exatamente o rastro que faltava.
autoUpdater.logger = log

// O launcher portable do electron-builder seta esta env; o binario portable
// nao tem instalador substituivel, entao auto-update fica desabilitado nele.
function ehPortable(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
}

function iniciarAutoUpdate(): void {
  log.info(
    `[updater] versão ${app.getVersion()}, empacotado=${app.isPackaged}, portable=${ehPortable()}`
  )
  if (!app.isPackaged || ehPortable()) return
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // Sem rede ou release indisponivel nao e erro fatal — apenas loga.
    log.error('[updater] checagem automatica falhou:', err)
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
    log.error('[updater] checagem manual falhou:', err)
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
    // `opcoesDeBackup()` como nos outros dois pontos de backup (boot e saida).
    // Sem elas este ia para a pasta padrao com retencao 10, ignorando o que o
    // usuario configurou em RF-CFG-01 — e justamente a copia que mais importa
    // achar depois, porque e a ultima antes de a importacao substituir TUDO.
    backupDatabase(dbPathAtual, opcoesDeBackup())
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
    // "Arquivo" saiu: suas ações agora vivem no menu da barra de título, via
    // IPC (`APP_IPC_CHANNELS`). "Editar" fica, e é o motivo de ainda existir um
    // menu — sem ele os aceleradores de desfazer, copiar e colar deixam de ser
    // registrados. Como a barra está com `autoHideMenuBar`, ele não ocupa
    // espaço: aparece só sob Alt.
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
  if (ehDev()) {
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
    // Sem isto o Chromium pinta branco ate o primeiro paint. No tema claro
    // quase nao se nota; no escuro e um flash branco de janela inteira. O
    // preload cuida do outro flash, o do conteudo. Ler o settings aqui e
    // sincrono e barato: ja estamos fora do caminho de renderizacao.
    backgroundColor: COR_DE_FUNDO_POR_TEMA[lerConfig(resolveSettingsPath()).tema],
    // Sem `titleBarOverlay`: os controles agora são do app, no material dele.
    // A altura da barra (32px) vive só no CSS — `.barra` em
    // `title-bar.module.css` e o `calc(100vh - 32px)` do `.shell` em
    // `app.module.css`, que precisam concordar entre si. Aqui não há mais
    // constante: sem overlay, o main não tem o que fazer com esse número, e
    // guardá-la só para documentar deixaria código morto.
    // As cores que existiam aqui saíram pelo mesmo motivo — elas alimentavam o
    // overlay, que o main precisava configurar antes de a página existir.
    // `hidden` só no Windows — em Linux (alvo secundário) a moldura nativa
    // permanece, e é ela que continua desenhando minimizar, maximizar e fechar.
    ...(process.platform === 'win32' ? { titleBarStyle: 'hidden' as const } : {}),
    // O menu nativo sobreviveu só pelos aceleradores de edição (ver
    // `construirMenuApp`); escondê-lo evita a segunda faixa de cromo, que é
    // justamente o que esta mudança veio remover.
    autoHideMenuBar: true,
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
  observarEstadoDaJanela(win)
  win.on('closed', () => {
    mainWindow = null
  })

  // window.open() abre no navegador externo do SO, nunca em uma nova janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    abrirExternoSeguro(url)
    return { action: 'deny' }
  })

  // Bloqueia navegação para fora do documento do app. Só o fragmento pode
  // mudar — é assim que o `createHashRouter` troca de tela. Qualquer outro
  // destino é cancelado e, se for http(s), entregue ao navegador do SO.
  //
  // A guarda anterior autorizava `file://` inteiro e comparava a URL corrente
  // por prefixo, o que a anulava enquanto a janela ainda não tinha página
  // (`startsWith('')` é sempre verdadeiro). Nada disso era alcançável — o
  // renderer não renderiza link nenhum —, mas a janela mantém o preload, então
  // o que passasse aqui carregaria com `window.api` ao alcance.
  win.webContents.on('will-navigate', (event, url) => {
    if (ehNavegacaoInterna(win.webContents.getURL(), url)) return
    event.preventDefault()
    abrirExternoSeguro(url)
  })

  if (ehDev() && process.env['ELECTRON_RENDERER_URL']) {
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
      reregistrarHandlersDeDados(db)
      registerConfigHandlers(resolveSettingsPath(), ipcMain, janelaAtual, {
        caminhoDoBanco: () => dbPathAtual,
        fechar: fecharBanco,
        reabrir: reabrirBanco
      })
      registerJanelaHandlers(ipcMain, janelaAtual)
      registerAppHandlers(ipcMain, {
        exportarDados,
        importarDados,
        verificarAtualizacoes: verificarAtualizacoesManual,
        sair: () => app.quit()
      })
      construirMenuApp()
      createWindow()
      iniciarTimerFechamento(db)
      iniciarAutoUpdate()
      verificarAvisos(db, resolveSettingsPath())

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
    if (ehDev()) console.log(`[main] recebido ${sinal}, encerrando.`)
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
