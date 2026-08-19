import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guard de regressão: tamanho de fonte mora em tokens.css, não solto no CSS da
 * feature.
 *
 * Eram **onze** tamanhos em 189 declarações — 10, 11, 12, 13, 14, 15, 16, 18,
 * 20, 22 e 26 —, e nenhum deles tokenizado. Doze e onze pixels lado a lado não
 * se distinguem; treze e quatorze, menos ainda. É essa a mecânica do "tudo tem
 * o mesmo peso" que a tese do refactor acusa: a escala não tinha degraus, tinha
 * um gradiente. Sem este guard ela volta a erodir um `font-size: 14px` por vez.
 *
 * Mesma forma do guard de cores, com a mesma justificativa.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(AQUI, '..', '..')

/** Exceções conscientes, com o motivo de cada uma. */
const PERMITIDOS = new Map([
  ['tokens.css', 'é a definição da escala'],
  ['print-mensal.module.css', 'folha A4 tem escala própria, em pt de papel']
])

/**
 * `font-size: 13px`. Ignora `var(--…)`, `%`, `em` e `inherit`.
 *
 * `clamp()` fica de fora por decisão: o número do hero da visão mensal é
 * `clamp(40px, 4.4vw, 64px)` — ele escala com a janela e por isso não pertence a
 * degrau nenhum. Tokenizá-lo seria inventar um sétimo degrau que só uma tela
 * usa, que é exatamente como os onze tamanhos apareceram.
 */
const FONT_SIZE = /font-size:\s*([^;}]+)/g

function listarCss(dir: string): string[] {
  const saida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) {
      if (entrada === 'node_modules') continue
      saida.push(...listarCss(caminho))
    } else if (entrada.endsWith('.css')) {
      saida.push(caminho)
    }
  }
  return saida
}

describe('escala de tipo do renderer', () => {
  it('nenhum font-size em px fora de tokens.css', () => {
    const encontrados: string[] = []

    for (const arquivo of listarCss(RENDERER)) {
      if (PERMITIDOS.has(basename(arquivo))) continue
      const conteudo = readFileSync(arquivo, 'utf8')
      for (const m of conteudo.matchAll(FONT_SIZE)) {
        const valor = m[1].trim()
        if (valor.startsWith('clamp(')) continue
        if (!/\d+px/.test(valor)) continue
        encontrados.push(`${arquivo.replace(RENDERER, 'src/renderer')}: font-size: ${valor}`)
      }
    }

    expect(encontrados, `use os tokens --text-*:\n${encontrados.join('\n')}`).toEqual([])
  })

  it('a escala tem exatamente seis degraus', () => {
    const tokens = readFileSync(join(RENDERER, 'styles', 'tokens.css'), 'utf8')
    const degraus = [...tokens.matchAll(/^\s*--text-(\d+)\s*:/gm)].map((m) => Number(m[1]))

    // Seis é o número do ponto 17 do diagnóstico, e é uma decisão, não um
    // acidente: um sétimo degrau é sempre mais fácil que escolher entre os que
    // já existem, e foi assim que os onze apareceram.
    expect(degraus.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
