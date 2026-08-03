import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Cold start do Electron sob contenção passa dos 30s default.
  timeout: 60000,
  expect: { timeout: 10000 },
  // Cada teste sobe sua própria instância do Electron com userData isolado
  // (TALLY_USER_DATA é aplicado antes do requestSingleInstanceLock no main),
  // então os specs podem rodar em paralelo. 4 workers — instâncias Electron
  // são pesadas, não vale saturar mais que isso.
  workers: 4,
  // 1 retry por contenção de recurso, não para mascarar teste ruim: 4 Electron
  // concorrentes disputando CPU e I/O fazem o seed dos specs mais pesados
  // (saidas-acoes-visiveis semeia 6 formulários, três vezes em paralelo)
  // estourar o expect.timeout de 10s de forma intermitente. Falha que se repete
  // na segunda tentativa é falha de verdade e continua vermelha.
  //
  // Isto era `process.env.CI ? 2 : 0`. Com os workflows removidos em ago/2026 a
  // variável CI nunca mais é setada, então a suíte passou a rodar sempre com
  // zero retries — a rede de proteção saiu junto com o CI, e a flake que ela
  // absorvia virou falha visível em toda execução completa.
  retries: 1,
  // Um .only esquecido faz a suite passar verde testando quase nada. Era
  // `!!process.env.CI`, ou seja, sem gate nenhum desde que os workflows saíram.
  // Agora barra por padrão; para depurar um teste isolado, rode com
  // TALLY_ALLOW_ONLY=1 (mesma variável do vitest.config.ts).
  forbidOnly: !process.env.TALLY_ALLOW_ONLY,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
