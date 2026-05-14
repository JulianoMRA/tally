import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/persistence/**'],
      thresholds: {
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
