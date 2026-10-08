import type { Page } from '@playwright/test'
import { anelDoDesignSystem, anelDoFoco } from './fixtures/anel-de-foco'
import { test, expect } from './fixtures/electron-app'
import { focarCartao, irPara } from './fixtures/navegacao'
import { semear } from './fixtures/seed'

/**
 * Gate de navegação por teclado. Nenhum dos defeitos que a fase 6 corrigiu
 * violava uma regra do axe — `<th onClick>` e modal sem foco são HTML válido,
 * só deixam a funcionalidade inalcançável. Por isso a varredura axe não basta e
 * este spec existe.
 */

async function foco(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return null
    return {
      tag: el.tagName,
      texto: (el.textContent ?? '').trim().slice(0, 40),
      rotulo: el.getAttribute('aria-label'),
      dentroDeDialogo: Boolean(el.closest('[role="dialog"]'))
    }
  })
}

test.describe('Navegação por teclado', () => {
  /**
   * Até out/2026 o anel de foco era um `box-shadow` no `:focus-visible` global.
   * O cartão selecionado do trilho e a linha do histórico declaram a própria
   * sombra com a mesma especificidade, num CSS que carrega depois: venciam, e o
   * foco de teclado ficava sem indicação nenhuma. O anel virou `outline`, que
   * sombra nenhuma apaga; os dois casos ficam para dizer que o cartão e a linha
   * mostram o anel do design system — a linha, o de dentro.
   *
   * O foco chega pela tecla, e não por `.focus()`: depois de um clique de
   * mouse, o foco por script não acende `:focus-visible`, e o teste passaria a
   * medir um estado que quem usa o teclado nunca vê.
   *
   * São dois casos, e não um: juntos, o teste parava no primeiro `expect`, e
   * no código sem a correção só o cartão era visto falhar — a linha do
   * histórico ficava sem prova.
   */
  test('em Faturas, o cartão selecionado mostra o anel de foco', async ({ app }) => {
    const { page } = await semear(app)
    await irPara(page, 'Faturas')
    await focarCartao(page, 'Nubank Seed')
    const anel = await anelDoDesignSystem(page)

    // Sai do cartão e volta pelo teclado: o clique o deixou focado, mas sem
    // `:focus-visible`.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /^Nubank Seed/ })).toBeFocused()
    await expect.poll(() => anelDoFoco(page), 'cartão selecionado sem anel de foco').toEqual(anel)
  })

  // O anel da linha é o de dentro. Ela encosta na borda do painel, que recorta
  // o que passa dela: o anel de fora aparecia em cima e embaixo e saía cortado
  // nas laterais — foi a folha de contato que mostrou.
  test('em Faturas, a linha do histórico mostra o anel de foco', async ({ app }) => {
    const { page } = await semear(app)
    await irPara(page, 'Faturas')
    // A fatura de mês anterior da seed está no Nubank.
    await focarCartao(page, 'Nubank Seed')
    const anel = await anelDoDesignSystem(page, 'dentro')

    // O clique abre a lista e deixa o foco no botão; o Tab leva à primeira
    // linha que é botão — a fatura em exibição fica na lista, mas não abre nada.
    await page.getByRole('button', { name: /meses anteriores/ }).click()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('listitem').getByRole('button').first()).toBeFocused()
    await expect.poll(() => anelDoFoco(page), 'linha do histórico sem anel de foco').toEqual(anel)
  })

  test('o foco recebe um anel visível do design system', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Saídas' }).focus()

    // Antes da fase 6 não havia `:focus-visible` em lugar nenhum: o app usava o
    // outline default do Chromium (0,8px laranja) sobre fundo creme.
    expect(await anelDoFoco(page), 'link focado sem anel de foco').toEqual(
      await anelDoDesignSystem(page)
    )
  })

  test('ordenar a tabela funciona só com o teclado', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    // Espera a lista terminar de carregar: sob concorrência o cabeçalho existe
    // antes das linhas, e a tecla chegava numa tabela que o React ainda ia
    // substituir — a ordenação não registrava.
    await expect(page.getByRole('cell', { name: 'Feira no Pix' })).toBeVisible()

    // "Compra" é a coluna que a tela abre ordenada, e por isso a que mais
    // importa alcançar pelo teclado. O comentário antigo aqui dizia que ela
    // "brigaria com o agrupamento" — brigava mesmo, e a saída foi a errada:
    // tirar a coluna. Agora ordenar por Compra achata os grupos de propósito.
    const cabecalho = page.getByRole('columnheader', { name: /Compra/ })
    const botao = cabecalho.getByRole('button')

    // Antes era um <th onClick>: sem role, sem tabIndex, sem teclado.
    // `locator.press` (e não focus + keyboard.press) porque o cabeçalho
    // re-renderiza ao ordenar: o locator é re-resolvido a cada chamada.
    await botao.press('Enter')
    await expect(cabecalho).toHaveAttribute('aria-sort', 'ascending')

    await botao.press(' ')
    await expect(cabecalho).toHaveAttribute('aria-sort', 'descending')
  })

  test('o menu de ações da linha abre, navega e fecha pelo teclado', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Feira no Pix' })
    const gatilho = linha.getByRole('button', { name: /^Mais ações/ })

    await gatilho.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()

    // O foco entra no primeiro item, e as setas circulam.
    // "Feira no Pix" e gasto fora de cartao, entao o menu comeca em "Marcar como
    // paga" (RF-DES-21) -- "Editar" e a acao primaria e fica fora do menu.
    expect((await foco(page))?.texto).toBe('Marcar como paga')
    await page.keyboard.press('ArrowDown')
    expect((await foco(page))?.texto).toBe('Duplicar')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    // Esc devolve o foco ao gatilho, senão o usuário fica perdido na página.
    expect((await foco(page))?.rotulo).toBe('Mais ações')
  })

  test('o foco entra no modal, fica preso e volta ao gatilho', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Feira no Pix' })
    const editar = linha.getByRole('button', { name: 'Editar', exact: true })
    await editar.focus()
    await page.keyboard.press('Enter')

    const dialogo = page.getByRole('dialog', { name: 'Editar despesa' })
    await expect(dialogo).toBeVisible()

    // Medido antes da fase 6: o foco continuava no botão da linha, FORA do
    // diálogo, e o Tab caminhava pela página atrás do overlay.
    expect((await foco(page))?.dentroDeDialogo, 'foco não entrou no modal').toBe(true)

    // Dez Tabs não podem escapar do diálogo.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      expect((await foco(page))?.dentroDeDialogo, `Tab ${i + 1} escapou do modal`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    expect((await foco(page))?.texto).toBe('Editar')
  })

  test('o controle segmentado é uma parada de Tab e navega com as setas', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const grupo = page.getByRole('radiogroup', { name: 'Filtrar lançamentos por tipo' })
    await expect(grupo).toBeVisible()

    await grupo.getByRole('radio', { name: /^Todas/ }).focus()
    await page.keyboard.press('ArrowRight')

    // Roving tabindex: a opção escolhida acompanha a seta.
    await expect(grupo.getByRole('radio', { name: /^À vista/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })
})
