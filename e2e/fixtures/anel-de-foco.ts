import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Medição do anel de foco do design system, que é um `outline` no
 * `:focus-visible` global.
 *
 * Até out/2026 o anel era um `box-shadow`, e três defeitos vinham daí: a sombra
 * própria de um elemento cancelava o anel, o raio forçado no foco mudava a forma
 * de quem tinha raio próprio, e o alto contraste do Windows, que não pinta
 * `box-shadow`, deixava o foco sem indicação nenhuma.
 */

/** O anel como o CSS computado o descreve. */
export type Anel = {
  estilo: string
  largura: string
  cor: string
  espaco: string
}

/**
 * Fora do elemento, como em quase tudo, ou por dentro, para o que encosta na
 * borda de um recipiente que recorta o que passa dela.
 */
export type VarianteDoAnel = 'fora' | 'dentro'

/**
 * O anel que os tokens produzem, lido de uma sonda. Comparar com o token, e não
 * com um valor escrito aqui, é o que diz que o elemento usa o anel do design
 * system, e não um outline qualquer.
 *
 * Sem os tokens a sonda responde `none`: conferir isso evita que sonda e
 * elemento respondam `none` os dois e o caso passe sem anel nenhum na tela.
 */
export async function anelDoDesignSystem(
  page: Page,
  variante: VarianteDoAnel = 'fora'
): Promise<Anel> {
  const anel = await page.evaluate((v) => {
    const sonda = document.createElement('div')
    sonda.style.outline = 'var(--focus-ring-width) solid var(--focus-ring-color)'
    sonda.style.outlineOffset =
      v === 'fora' ? 'var(--focus-ring-offset)' : 'var(--focus-ring-offset-inset)'
    document.body.appendChild(sonda)
    const estilo = getComputedStyle(sonda)
    const lido = {
      estilo: estilo.outlineStyle,
      largura: estilo.outlineWidth,
      cor: estilo.outlineColor,
      espaco: estilo.outlineOffset
    }
    sonda.remove()
    return lido
  }, variante)

  expect(anel.estilo, 'os tokens do anel não produzem outline').toBe('solid')
  const espaco = parseFloat(anel.espaco)
  if (variante === 'fora') {
    expect(espaco, 'o anel de fora não fica fora do elemento').toBeGreaterThan(0)
  } else {
    expect(espaco, 'o anel de dentro não fica dentro do elemento').toBeLessThan(0)
  }
  return anel
}

/** O outline computado do elemento que está com o foco. */
export async function anelDoFoco(page: Page): Promise<Anel> {
  return page.evaluate(() => {
    const estilo = getComputedStyle(document.activeElement ?? document.body)
    return {
      estilo: estilo.outlineStyle,
      largura: estilo.outlineWidth,
      cor: estilo.outlineColor,
      espaco: estilo.outlineOffset
    }
  })
}

/**
 * Liga o alto contraste emulado e confere que o Chromium aplicou o modo, e não
 * só a media query: no modo de verdade, `box-shadow` não é pintado. Sem essa
 * prova, os casos de alto contraste passariam com o anel de sombra na tela.
 */
export async function ligarAltoContraste(page: Page): Promise<void> {
  await page.emulateMedia({ forcedColors: 'active' })

  const fotografarSonda = async (sombra: string): Promise<Buffer> => {
    await page.evaluate((valor) => {
      let sonda = document.getElementById('sonda-alto-contraste')
      if (!sonda) {
        sonda = document.createElement('div')
        sonda.id = 'sonda-alto-contraste'
        Object.assign(sonda.style, {
          position: 'fixed',
          left: '300px',
          top: '300px',
          width: '40px',
          height: '40px',
          zIndex: '9999',
          background: 'rgb(0, 0, 255)'
        })
        document.body.appendChild(sonda)
      }
      sonda.style.boxShadow = valor
    }, sombra)
    return page.screenshot({
      clip: { x: 290, y: 290, width: 60, height: 60 },
      animations: 'disabled'
    })
  }

  const comSombra = await fotografarSonda('0 0 0 6px rgb(255, 0, 0)')
  const semSombra = await fotografarSonda('none')
  await page.evaluate(() => document.getElementById('sonda-alto-contraste')?.remove())
  expect(
    comSombra.equals(semSombra),
    'a emulação não aplicou o alto contraste: o box-shadow continua pintado'
  ).toBe(true)
}

/**
 * A faixa em volta do elemento, da borda até a folga, sem o miolo: é ali que o
 * anel aparece. O miolo fica de fora porque o alto contraste repinta a cor que
 * o Playwright usa para esconder o cursor de texto, e o cursor dentro do campo
 * fazia o recorte com foco diferir do sem foco — o caso do campo passou assim,
 * na main, sem anel nenhum na tela.
 */
export async function faixaEmVolta(page: Page, alvo: Locator): Promise<Buffer> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('o elemento não está na tela')
  const { x, y, width, height } = caixa
  const folga = 8
  // 1px de distância da borda: o pixel do limite é meio borda, meio fora.
  const espessura = folga - 1
  const lados = [
    { x: x - folga, y: y - folga, width: width + 2 * folga, height: espessura },
    { x: x - folga, y: y + height + 1, width: width + 2 * folga, height: espessura },
    { x: x - folga, y, width: espessura, height },
    { x: x + width + 1, y, width: espessura, height }
  ]
  const imagens: Buffer[] = []
  for (const clip of lados) {
    imagens.push(await page.screenshot({ clip, animations: 'disabled' }))
  }
  return Buffer.concat(imagens)
}
