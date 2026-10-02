import type { Page } from '@playwright/test'
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
      dentroDeDialogo: Boolean(el.closest('[role="dialog"]')),
      boxShadow: getComputedStyle(el).boxShadow
    }
  })
}

/**
 * O `box-shadow` que o anel de foco produz, lido de uma sonda com a mesma
 * variável. Comparar com "diferente de `none`" não serve onde o elemento já tem
 * sombra própria — é exatamente o caso que este spec precisa pegar.
 */
async function anelDeFoco(page: Page): Promise<string> {
  return page.evaluate(() => {
    const sonda = document.createElement('div')
    sonda.style.boxShadow = 'var(--focus-ring)'
    document.body.appendChild(sonda)
    const valor = getComputedStyle(sonda).boxShadow
    sonda.remove()
    return valor
  })
}

/** O `box-shadow` computado do elemento que está com o foco. */
async function sombraDoFoco(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.activeElement as Element).boxShadow)
}

test.describe('Navegação por teclado', () => {
  /**
   * O anel de foco é um `box-shadow` no `:focus-visible` global. O cartão
   * selecionado do trilho e a linha do histórico declaram a própria sombra com
   * a mesma especificidade, num CSS que carrega depois: venciam, e o foco de
   * teclado ficava sem indicação nenhuma.
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
    const anel = await anelDeFoco(page)

    // Sai do cartão e volta pelo teclado: o clique o deixou focado, mas sem
    // `:focus-visible`.
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /^Nubank Seed/ })).toBeFocused()
    // `poll`: a sombra tem transição, e o valor computado leva um instante.
    await expect.poll(() => sombraDoFoco(page), 'cartão selecionado sem anel de foco').toBe(anel)
  })

  test('em Faturas, a linha do histórico mostra o anel de foco', async ({ app }) => {
    const { page } = await semear(app)
    await irPara(page, 'Faturas')
    // A fatura de mês anterior da seed está no Nubank.
    await focarCartao(page, 'Nubank Seed')
    const anel = await anelDeFoco(page)

    // O clique abre a lista e deixa o foco no botão; o Tab leva à primeira linha.
    await page.getByRole('button', { name: /meses anteriores/ }).click()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('listitem').first().getByRole('button')).toBeFocused()
    await expect.poll(() => sombraDoFoco(page), 'linha do histórico sem anel de foco').toBe(anel)
  })

  test('o foco recebe um anel visível do design system', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Saídas' }).focus()
    const atual = await foco(page)

    // Antes da fase 6 não havia `:focus-visible` em lugar nenhum: o app usava o
    // outline default do Chromium (0,8px laranja) sobre fundo creme.
    expect(atual?.boxShadow, 'link focado sem anel de foco').not.toBe('none')
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
