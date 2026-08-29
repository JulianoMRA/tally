import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // `electron/**` entrou em ago/2026: a camada do main process tinha zero
    // testes e nenhum caminho para ganhar um, porque o include nao a alcancava.
    // Sao os handlers IPC, a exportacao de PDF, os avisos e as guardas de
    // navegacao — codigo de fronteira, justamente onde erro passa despercebido.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts'],
    // O default do vitest é `!process.env.CI`. Sem CI desde ago/2026, isso
    // liberava .only para sempre: um `it.only` esquecido deixava a suíte verde
    // pulando o resto do arquivo (medido: 693 passed | 13 skipped, exit 0).
    // Para depurar um teste isolado, rode com TALLY_ALLOW_ONLY=1 (mesma
    // variável do playwright.config.ts).
    allowOnly: !!process.env.TALLY_ALLOW_ONLY,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/persistence/**'],
      // RNF-06: 80% no domain (RN-XX criticas) + 60% global.
      thresholds: {
        'src/domain/**': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80
        },
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    }
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@persistence': resolve(__dirname, 'src/persistence'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
