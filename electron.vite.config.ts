import { resolve } from 'path'
import { createRequire } from 'node:module'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// A versao exibida na sidebar vinha hardcoded e ficou defasada do package.json
// (dizia v1.1 numa build 1.1.1). Agora e injetada em build time.
const { version: versaoDoApp } = createRequire(import.meta.url)('./package.json') as {
  version: string
}

// CSP estrita aplicada APENAS no build de producao, via <meta> no index.html.
// O index.html e compartilhado com o dev server, onde a CSP chega por header
// (electron/main.ts) e precisa ser permissiva para o HMR do Vite. Por isso o
// plugin roda so em `apply: 'build'` e nao afeta `electron-vite dev`.
// 'unsafe-inline' em style-src e exigido por CSS Modules + estilos inline do recharts.
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; " +
  "object-src 'none'; base-uri 'self'"

function cspMetaPlugin(): Plugin {
  return {
    name: 'tally-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      // Injeta logo apos o charset para que a CSP preceda as tags de script/link
      // que o Vite adiciona ao final do <head> — uma CSP via <meta> so governa o
      // que vem depois dela no documento.
      const meta = `\n    <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}" />`
      return html.replace(/(<meta charset=["'][^"']*["']\s*\/>)/i, `$1${meta}`)
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main.ts')
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts')
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), cspMetaPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(versaoDoApp)
    },
    build: {
      rollupOptions: {
        output: {
          // Isola libs pesadas em chunks proprios: recharts so carrega na rota de
          // relatorios; o vendor React fica num chunk cacheavel a parte.
          manualChunks: {
            recharts: ['recharts'],
            react: ['react', 'react-dom', 'react-router-dom']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@domain': resolve(__dirname, 'src/domain'),
        '@persistence': resolve(__dirname, 'src/persistence'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
})
