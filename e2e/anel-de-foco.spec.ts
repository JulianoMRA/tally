import { test, expect } from './fixtures/electron-app'
import { faixaEmVolta, ligarAltoContraste } from './fixtures/anel-de-foco'
import { irPara } from './fixtures/navegacao'

/**
 * Gate do anel de foco no alto contraste do Windows: o foco continua
 * aparecendo — no link, pelo anel; no campo, pelo outline transparente que o
 * tema pinta no lugar do halo.
 */

test.describe('Anel de foco', () => {
  /*
   * O tema de contraste do Windows não pinta `box-shadow`. Com o anel de sombra
   * e o `outline` zerado no global, quem usa o tema não via onde estava o foco.
   *
   * A prova é a imagem, e não o estilo computado: o que o modo troca é o que
   * se pinta. Mesmo princípio da folha de contato, que fotografa o foco e a
   * tela sem ele e exige que as duas difiram.
   */
  test('em alto contraste, o link focado mostra o anel', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await ligarAltoContraste(page)

    const link = page.getByRole('link', { name: 'Saídas' })
    // Antes de qualquer clique, o foco por script acende `:focus-visible`.
    await link.focus()
    const comFoco = await faixaEmVolta(page, link)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const semFoco = await faixaEmVolta(page, link)

    expect(comFoco.equals(semFoco), 'em alto contraste, o foco no link não aparece').toBe(false)
  })

  // O campo fica fora do anel por decisão: borda da marca e halo, que o modo
  // também apaga. Quem aparece no lugar deles é o outline transparente.
  test('em alto contraste, o campo focado mostra o anel', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await irPara(page, 'Busca')
    await ligarAltoContraste(page)

    const campo = page.getByLabel('Descrição contém')
    await campo.focus()
    const comFoco = await faixaEmVolta(page, campo)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const semFoco = await faixaEmVolta(page, campo)

    expect(comFoco.equals(semFoco), 'em alto contraste, o foco no campo não aparece').toBe(false)
  })
})
