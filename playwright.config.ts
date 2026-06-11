import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // CI runner é mais lento que dev local; 60s evita flakes.
  timeout: 60000,
  expect: { timeout: 10000 },
  // Cada teste sobe sua própria instância do Electron com userData isolado
  // (TALLY_USER_DATA é aplicado antes do requestSingleInstanceLock no main),
  // então os specs podem rodar em paralelo. 2 no CI (runner de 2 vCPUs);
  // 4 localmente — instâncias Electron são pesadas, não vale saturar.
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
