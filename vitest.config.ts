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
      // `include` cobria so domain e persistence: 5.550 das 20.845 linhas de
      // producao, ou 27% do app. O renderer (11.378 linhas, mais da metade do
      // codigo e o maior numero de arquivos de teste do projeto) nao entrava em
      // nenhum piso, e nem `shared` nem `electron`.
      //
      // O efeito era pior do que "nao medido": o piso global de 60% incidia
      // sobre as duas camadas que ja sao exigidas a 80%, e media 99%. Peso
      // morto. E o global honesto, medido com o include abaixo, e 57,7% — ou
      // seja, o app reprovaria no proprio gate que o README anunciava.
      include: ['src/**', 'electron/**'],
      // Os pisos por camada ficam um degrau abaixo do medido em 08/09/2026,
      // para servirem de catraca: seguram regressao sem quebrar no primeiro
      // commit. Medido na epoca (linhas): domain 98,5 / persistence 99,2 /
      // shared 90,4 / renderer 45,4 / electron 10,1 / global 57,7.
      //
      // O piso do `electron` e feio de proposito. E divida declarada: aquela
      // camada tem 27 testes para 2.049 linhas, e `main.ts` nao e exercitavel
      // sem subir o Electron. Um numero baixo e visivel vale mais do que a
      // ausencia de numero, que era o estado anterior.
      //
      // Arquivo coberto por glob TAMBEM entra na conta global — verificado com
      // uma sonda, nao suposto: um piso global de 99,1% reprovou com os 99,04%
      // de domain+persistence, ainda que domain tivesse glob proprio.
      thresholds: {
        // RNF-06: 80% no domain (RN-XX criticas).
        'src/domain/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
        'src/persistence/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/shared/**': { lines: 85, functions: 60, branches: 80, statements: 85 },
        'src/renderer/**': { lines: 40, functions: 55, branches: 80, statements: 40 },
        'electron/**': { lines: 10, functions: 30, branches: 50, statements: 10 },
        lines: 55,
        functions: 70,
        branches: 80,
        statements: 55
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
