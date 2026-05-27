import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // CI Windows runner é ~3x mais lento que dev local; 60s evita flakes
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
