import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guard de regressão: toda custom property usada via `var(--x)` SEM fallback
 * precisa estar definida em tokens.css. Um `var()` de propriedade inexistente
 * é inválido e a declaração é descartada silenciosamente — foi assim que
 * `--ink-muted` e `--bg-base` quebraram estilos em 7 features sem ninguém ver.
 *
 * `var(--x, fallback)` é ignorado de propósito: o fallback é uma escolha
 * explícita e resolve mesmo sem o token.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(AQUI, '..', '..')
const TOKENS_CSS = join(AQUI, '..', 'tokens.css')

function listarArquivos(dir: string, exts: string[]): string[] {
  const saida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) {
      if (entrada === 'node_modules') continue
      saida.push(...listarArquivos(caminho, exts))
    } else if (exts.some((ext) => entrada.endsWith(ext))) {
      saida.push(caminho)
    }
  }
  return saida
}

function tokensDefinidos(): Set<string> {
  const css = readFileSync(TOKENS_CSS, 'utf8')
  const nomes = new Set<string>()
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) nomes.add(m[1])
  return nomes
}

/** Captura `var(--x` mas não `var(--x,` (fallback presente). */
const USO_SEM_FALLBACK = /var\(\s*(--[a-z0-9-]+)\s*\)/g

describe('tokens CSS', () => {
  it('todo var(--token) sem fallback está definido em tokens.css', () => {
    const definidos = tokensDefinidos()
    const arquivos = listarArquivos(RENDERER, ['.css', '.tsx'])
    const faltando: string[] = []

    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, 'utf8')
      for (const m of conteudo.matchAll(USO_SEM_FALLBACK)) {
        const token = m[1]
        if (!definidos.has(token)) {
          faltando.push(`${token}  em  ${arquivo.replace(RENDERER, 'src/renderer')}`)
        }
      }
    }

    expect(
      faltando,
      `Tokens usados sem fallback mas não definidos em tokens.css:\n${[...new Set(faltando)].join('\n')}`
    ).toEqual([])
  })
})
