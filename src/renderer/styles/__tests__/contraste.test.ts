import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Guard de contraste: todo par texto/superfície que o axe mede precisa passar
 * no WCAG AA, em TODOS os temas definidos em tokens.css.
 *
 * Existe porque o axe só enxerga o que está na tela. Três defeitos de contraste
 * já passaram batido pelo mesmo buraco — `--ink-3`, `--pending` e `--paid` —, e
 * o último ficou escondido por mais tempo que os outros: o badge "Paga" exige
 * uma fatura fechada E paga, e o seed do E2E nunca criava nenhuma. Aqui os
 * pares são conferidos por cálculo, sem depender de a tela ter o dado.
 *
 * Não substitui o axe: ele pega o que está montado de verdade, inclusive
 * combinações que ninguém listou aqui. Os dois se cobrem em buracos diferentes.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const TOKENS_CSS = join(AQUI, '..', 'tokens.css')

/** Luminância relativa (WCAG 2.x). */
function luminancia(hex: string): number {
  const s = hex.replace('#', '')
  const canais = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
  const linear = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function razaoDeContraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

const SEM_COMENTARIOS = /\/\*[\s\S]*?\*\//g
const HEX_PURO = /^#[0-9a-fA-F]{6}$/

/**
 * Lê as custom properties de um bloco. O fecha-chaves é procurado no início de
 * linha porque é assim que o arquivo é formatado pelo Prettier, e comentários
 * saem antes para não doarem falsos positivos ao regex de propriedade.
 */
function lerBloco(css: string, seletor: RegExp): Map<string, string> {
  const limpo = css.replace(SEM_COMENTARIOS, '')
  const achado = limpo.match(seletor)
  if (achado?.index === undefined) return new Map()
  const abre = limpo.indexOf('{', achado.index)
  const fecha = limpo.indexOf('\n}', abre)
  const corpo = limpo.slice(abre + 1, fecha)

  const tokens = new Map<string, string>()
  for (const m of corpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(m[1], m[2].trim())
  }
  return tokens
}

/**
 * Aspas simples, duplas ou nenhuma. O Prettier hoje deixa simples, mas casar o
 * seletor por string literal transformaria uma reformatação em guard que passa
 * sem conferir nada — modo de falha pior que não ter guard.
 */
const SELETOR_ESCURO = /\[data-theme\s*=\s*['"]?escuro['"]?\s*\]/

/**
 * Temas encontrados no arquivo. O escuro só redefine valores, então herda o
 * claro por baixo — e é justamente por herdar que um token esquecido lá vira
 * uma cor clara sobre fundo escuro em vez de sumir sem deixar rastro.
 */
function lerTemas(): Map<string, Map<string, string>> {
  const css = readFileSync(TOKENS_CSS, 'utf8')
  const claro = lerBloco(css, /:root/)
  const escuro = lerBloco(css, SELETOR_ESCURO)

  return new Map([
    ['claro', claro],
    ['escuro', new Map([...claro, ...escuro])]
  ])
}

/** [texto, superfície, mínimo, o que é na tela] */
const PARES: ReadonlyArray<readonly [string, string, number, string]> = [
  ['--ink', '--bg', 4.5, 'corpo sobre o fundo da página'],
  ['--ink', '--bg-elev', 4.5, 'corpo sobre card'],
  ['--ink-2', '--bg', 4.5, 'texto secundário'],
  ['--ink-3', '--bg', 4.5, 'texto terciário sobre o fundo'],
  ['--ink-3', '--bg-elev', 4.5, 'texto terciário sobre card'],
  ['--ink-3', '--bg-sunk', 4.5, 'texto terciário na sidebar e no thead'],
  ['--on-brand', '--brand', 4.5, 'rótulo do botão primário e do item ativo'],
  ['--on-forest', '--forest', 4.5, 'número do hero'],
  ['--on-forest-2', '--forest', 4.5, 'apoio do hero'],
  ['--income', '--income-bg', 4.5, 'badge de entrada'],
  ['--paid', '--income-bg', 4.5, 'badge "Paga"'],
  ['--pending', '--pending-bg', 4.5, 'badge "Aberta"'],
  ['--expense', '--expense-bg', 4.5, 'badge de saída'],
  ['--closed', '--closed-bg', 4.5, 'badge "Fechada" e "Projeção"'],
  ['--ink-3', '--bg-sunk', 4.5, 'badge "Arquivada"'],
  ['--income', '--bg', 4.5, 'valor de entrada sobre o fundo'],
  ['--expense', '--bg', 4.5, 'valor de saída sobre o fundo'],
  ['--income', '--bg-elev', 4.5, 'valor de entrada sobre card'],
  ['--expense', '--bg-elev', 4.5, 'valor de saída sobre card'],
  // Fatias são superfície, não texto: o mínimo de componente gráfico é 3:1.
  ['--fatia-entradas', '--forest', 3, 'fatia de entradas na barra do hero'],
  ['--fatia-faturas', '--forest', 3, 'fatia de faturas na barra do hero'],
  ['--fatia-fora-cartao', '--forest', 3, 'fatia de fora do cartão na barra do hero']
]

/** Um token "carrega cor" se o valor tem hex ou rgb()/rgba() literal. */
const CARREGA_COR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

/**
 * Tokens que herdam do claro DE PROPÓSITO, com o motivo. Qualquer outro token
 * de cor precisa de contraparte no escuro — herdar por esquecimento é como um
 * badge acaba com tinta clara sobre superfície clara.
 */
const HERANCA_DELIBERADA = new Map([
  ['--fatia-entradas', 'calibrada para fundo escuro; o hero é escuro nos dois temas'],
  ['--fatia-faturas', 'idem'],
  ['--fatia-fora-cartao', 'idem']
])

describe('paridade entre os temas', () => {
  it('todo token de cor do tema claro tem contraparte no escuro', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8')
    const claro = lerBloco(css, /:root/)
    const escuro = lerBloco(css, SELETOR_ESCURO)

    expect(
      escuro.size,
      'O bloco [data-theme="escuro"] sumiu de tokens.css, ou o seletor mudou de ' +
        'forma que o guard não reconhece. Sem ele, o teste de contraste do tema ' +
        'escuro estaria conferindo a paleta clara e passando à toa.'
    ).toBeGreaterThan(0)

    const semContraparte: string[] = []
    for (const [token, valor] of claro) {
      if (!CARREGA_COR.test(valor)) continue
      if (HERANCA_DELIBERADA.has(token)) continue
      if (!escuro.has(token)) semContraparte.push(`${token}: ${valor}`)
    }

    expect(
      semContraparte,
      'Tokens de cor sem valor no tema escuro. Defina em [data-theme="escuro"], ' +
        'ou registre em HERANCA_DELIBERADA com o motivo:\n' +
        semContraparte.join('\n')
    ).toEqual([])
  })

  it('não define no escuro token que o claro não tem', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8')
    const claro = lerBloco(css, /:root/)
    const escuro = lerBloco(css, SELETOR_ESCURO)

    // color-scheme não é custom property e não entra na varredura.
    const orfaos = [...escuro.keys()].filter((t) => !claro.has(t))

    expect(
      orfaos,
      `Token que só existe no tema escuro:\n${orfaos.join('\n')}\n` +
        'O :root é a definição da paleta — cor cuja única definição estivesse ' +
        'atrás de [data-theme] simplesmente não existiria no tema claro.'
    ).toEqual([])
  })
})

describe('contraste da paleta', () => {
  const temas = lerTemas()

  for (const [nomeDoTema, tokens] of temas) {
    describe(`tema ${nomeDoTema}`, () => {
      it('todo par de texto e superfície passa no WCAG AA', () => {
        const reprovados: string[] = []

        for (const [textoToken, fundoToken, minimo, oQueE] of PARES) {
          const texto = tokens.get(textoToken)
          const fundo = tokens.get(fundoToken)

          expect(texto, `${textoToken} não está definido no tema ${nomeDoTema}`).toBeDefined()
          expect(fundo, `${fundoToken} não está definido no tema ${nomeDoTema}`).toBeDefined()
          if (!HEX_PURO.test(texto!) || !HEX_PURO.test(fundo!)) continue

          const razao = razaoDeContraste(texto!, fundo!)
          if (razao < minimo) {
            reprovados.push(
              `${oQueE}: ${razao.toFixed(2)}:1 (mínimo ${minimo}) ` +
                `— ${textoToken} ${texto} sobre ${fundoToken} ${fundo}`
            )
          }
        }

        expect(
          reprovados,
          `Contraste abaixo do WCAG AA no tema ${nomeDoTema}:\n${reprovados.join('\n')}`
        ).toEqual([])
      })
    })
  }
})
