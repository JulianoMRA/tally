import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // CI runner é mais lento que dev local; 60s evita flakes.
  timeout: 60000,
  expect: { timeout: 10000 },
  // Serial obrigatório: cada teste sobe uma instância do Electron, e o
  // requestSingleInstanceLock() é adquirido antes do override de TALLY_USER_DATA,
  // então instâncias paralelas competem pelo mesmo lock (userData padrão) e falham.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
