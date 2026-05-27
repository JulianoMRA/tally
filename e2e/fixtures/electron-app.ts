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
    const app = await electron.launch({
      args: [mainEntry],
      env: { ...process.env, TALLY_USER_DATA: userDataDir }
    })
    await use(app)
    await app.close()
  }
})

export { expect } from '@playwright/test'
