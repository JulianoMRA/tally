import { defineConfig } from 'vitest/config'

// Config dedicado ao Stryker: apenas os testes do domain (puros, sem wasm,
// sem jsdom, sem aliases — imports relativos), sem plugin react e sem
// coverage. O sandbox do Stryker nao roda bem a suite completa e o runner
// perTest so precisa dos testes que cobrem os arquivos mutados.
export default defineConfig({
  test: {
    include: ['src/domain/**/__tests__/**/*.test.ts']
  }
})
