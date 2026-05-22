import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
