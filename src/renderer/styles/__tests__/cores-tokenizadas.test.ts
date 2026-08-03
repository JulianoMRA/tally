import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guard de regressão: cor de paleta mora em tokens.css, não solta no CSS da
 * feature. Hex espalhado foi o que fez os badges de Fechada/Projeção usarem um
 * roxo que não existia como token e os banners de sucesso repetirem o mesmo par
 * verde em quatro arquivos — mudar a paleta exigia caçar literais.
 *
 * `rgba()` de sombra e overlay não entra na varredura: são efeitos de
 * profundidade, não cor de marca, e já vivem em --shadow-1/2 quando reusáveis.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(AQUI, '..', '..')

/** Exceções conscientes, com o motivo de cada uma. */
const PERMITIDOS = new Map([
  ['tokens.css', 'é a definição da paleta'],
  ['print-mensal.module.css', 'branco puro de folha A4, independente do tema']
])

const HEX = /#[0-9a-fA-F]{3,8}\b/g

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

describe('cores do renderer', () => {
  it('nenhum hex hardcoded fora de tokens.css', () => {
    const encontrados: string[] = []

    for (const arquivo of listarCss(RENDERER)) {
      if (PERMITIDOS.has(basename(arquivo))) continue
      const linhas = readFileSync(arquivo, 'utf8').split('\n')
      linhas.forEach((linha, i) => {
        for (const m of linha.matchAll(HEX)) {
          encontrados.push(`${arquivo.replace(RENDERER, 'src/renderer')}:${i + 1}  ${m[0]}`)
        }
      })
    }

    expect(
      encontrados,
      `Cor hardcoded no CSS. Defina um token em tokens.css e use var():\n${encontrados.join('\n')}`
    ).toEqual([])
  })
})
