import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8')
}

/** `{ path: 'x', …, handle: { titulo: 'Y' } }` → `{ x: 'Y' }` */
function titulosDoRouter(): Record<string, string> {
  const fonte = ler('router.tsx')
  const mapa: Record<string, string> = {}
  for (const m of fonte.matchAll(/path: '([^']+)'[^}]*?handle: \{ titulo: '([^']+)' \}/g)) {
    mapa[m[1]] = m[2]
  }
  return mapa
}

/** `{ to: '/x', label: 'Y', … }` da `NAV` da Sidebar → `{ x: 'Y' }` */
function rotulosDaNav(): Record<string, string> {
  const fonte = ler('components/layout/Sidebar.tsx')
  const mapa: Record<string, string> = {}
  for (const m of fonte.matchAll(/to: '\/([^']+)',\s*\n\s*label: '([^']+)'/g)) {
    mapa[m[1]] = m[2]
  }
  return mapa
}

function titulosDasPaginas(): string[] {
  const arquivos: string[] = []
  for (const feature of readdirSync(join(RAIZ, 'features'))) {
    const dir = join(RAIZ, 'features', feature)
    for (const nome of readdirSync(dir)) {
      if (nome.endsWith('Page.tsx')) arquivos.push(join(dir, nome))
    }
  }
  return arquivos
    .map((f) => readFileSync(f, 'utf8'))
    .flatMap((fonte) => [...fonte.matchAll(/<PageHead\s+title="([^"]+)"/g)].map((m) => m[1]))
}

/**
 * O `h1` da tela vive na barra de título e vem de `handle.titulo` da rota. O par
 * link-de-nav ↔ `h1` é o que o leitor de tela e o helper `irPara` dos E2E usam
 * para confirmar onde a navegação parou, e ele só funciona se os dois nomes
 * forem idênticos.
 *
 * Antes o `PageHead` renderizava o título, então divergir aparecia na tela.
 * Agora não aparece em lugar nenhum — é este teste que denuncia.
 *
 * Lê o código-fonte em vez de importar os módulos de propósito: importar
 * `router.tsx` arrastaria as oito páginas e o Electron junto, e a `NAV` da
 * Sidebar não é exportada.
 */
describe('títulos de rota', () => {
  it('cobre as nove rotas de tela', () => {
    expect(Object.keys(titulosDoRouter()).sort()).toEqual([
      'ajustes',
      'cartoes',
      'categorias',
      'faturas',
      'importar',
      'mensal',
      'rendas',
      'saidas',
      'simulacao'
    ])
  })

  it('usa exatamente os rótulos da navegação', () => {
    expect(titulosDoRouter()).toEqual(rotulosDaNav())
  })

  it('bate com o `title` que cada página passa ao PageHead', () => {
    const daRota = Object.values(titulosDoRouter())
    const daPagina = titulosDasPaginas()

    expect(daPagina.length).toBeGreaterThanOrEqual(9)
    for (const titulo of daPagina) {
      expect(daRota).toContain(titulo)
    }
  })
})
