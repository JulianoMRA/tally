import { BrowserWindow } from 'electron'
import { join } from 'path'
import { ehDev } from './ambiente'

/**
 * Renderiza a rota de impressão (#/print/:mes) numa janela oculta e devolve o
 * PDF. A página marca `data-print-pronto` no relatório quando os dados do IPC
 * chegam — o poll abaixo espera esse marcador em vez de um sleep arbitrário.
 */
export async function gerarPdfDoMes(mes: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // As mesmas guardas da janela principal. Esta carrega o MESMO preload, logo
  // tem `window.api` inteiro — e como ela é oculta, o que acontecesse aqui não
  // teria nem a chance de ser notado. Ela existe para renderizar uma rota e
  // virar PDF: nada deve navegar nem abrir janela a partir dela.
  //
  // Cancelar toda navegação não atrapalha o carregamento: `will-navigate` não
  // dispara para `loadURL`/`loadFile` chamados pelo main, só para navegação
  // iniciada pela própria página.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  try {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (ehDev() && rendererUrl) {
      await win.loadURL(`${rendererUrl}#/print/${mes}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/print/${mes}` })
    }
    await aguardarMarcador(win, 8000)
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 1, bottom: 1, left: 1, right: 1 }
    })
  } finally {
    win.destroy()
  }
}

async function aguardarMarcador(win: BrowserWindow, timeoutMs: number): Promise<void> {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const pronto = (await win.webContents.executeJavaScript(
      `Boolean(document.querySelector('[data-print-pronto]'))`
    )) as boolean
    if (pronto) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Tempo esgotado aguardando a página de impressão carregar os dados.')
}
