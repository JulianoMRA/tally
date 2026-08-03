import { defineConfig } from 'vitest/config'

// Config dedicado ao Stryker: apenas os testes do domain (puros, sem wasm,
// sem jsdom, sem aliases — imports relativos), sem plugin react e sem
// coverage. O sandbox do Stryker nao roda bem a suite completa e o runner
// perTest so precisa dos testes que cobrem os arquivos mutados.
export default defineConfig({
  test: {
    include: ['src/domain/**/__tests__/**/*.test.ts'],
    // Mesmo gate do vitest.config.ts: um .only escaparia daqui como score de
    // mutação calculado sobre um subconjunto, sem nada indicando isso.
    allowOnly: !!process.env.TALLY_ALLOW_ONLY
  }
})
