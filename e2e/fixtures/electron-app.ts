import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mainEntry = join(__dirname, '..', '..', 'out', 'main', 'index.cjs')

type ElectronFixtures = {
  app: ElectronApplication
  userDataDir: string
}

/**
 * Fixture isolada: cada teste recebe um app Electron apontando para um
 * diretório userData temporário. Garante que E2E nunca toque na base real
 * do usuário (%APPDATA%/Tally/tally.db).
 *
 * O main process respeita process.env.TALLY_USER_DATA via app.setPath.
 */
export const test = base.extend<ElectronFixtures>({
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'tally-e2e-'))
    await use(dir)
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // cleanup best-effort: Windows pode segurar o handle por instantes
    }
  },
  app: async ({ userDataDir }, use) => {
    // timeout: runners de CI com 2 workers tem cold start lento do Electron —
    // o default de 30s produzia "Process failed to launch" intermitente.
    const app = await electron.launch({
      args: [mainEntry],
      env: { ...process.env, TALLY_USER_DATA: userDataDir },
      timeout: 60_000
    })
    // Viewport deterministico: em telas menores que 1280x800 (runner de CI e
    // 1024x768) o SO clampa a janela na criacao, colunas 1fr de grids
    // colapsavam para largura zero e toBeVisible falhava so no CI. No Windows
    // a janela pode ser maior que a tela, entao o setSize pos-criacao vale.
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1280, 800)
    })
    await use(app)
    await app.close()
  }
})

export { expect } from '@playwright/test'
