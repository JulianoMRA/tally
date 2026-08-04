import { test, expect } from './fixtures/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

/**
 * Guarda de geometria para as ações da tabela de Parcelas do detalhe de fatura.
 *
 * Contexto: a tabela de Saídas teve suas ações decepadas pelo `overflow: hidden`
 * do Panel e precisou de um container rolável. O FaturaDetalhe NÃO tem esse
 * problema, mas só porque seu `.rowActions` usa `flex-wrap: wrap` — a coluna de
 * ações quebra em linhas e a tabela consegue comprimir.
 *
 * Essa dependência é frágil: os dois módulos têm uma classe `.rowActions` de
 * mesmo nome e propósito, e a de Saídas hoje usa `nowrap` + `flex-shrink: 0`.
 * Uniformizar os dois sem medir reintroduz o bug aqui. Este spec falha se isso
 * acontecer.
 */

async function redimensionar(app: ElectronApplication, largura: number) {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0]?.setSize(w, 800)
  }, largura)
}

async function semear(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.getByRole('link', { name: 'Cartões' }).click()
  await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
  await page.getByLabel('Nome').fill('Inter Geometria E2E')
  await page.getByLabel('Dia de fechamento').fill('5')
  await page.getByLabel('Dia de vencimento').fill('12')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Inter Geometria E2E')).toBeVisible()

  await page.getByRole('link', { name: 'Categorias' }).click()
  await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
  await page.getByLabel('Nome').fill('Mercado Geometria E2E')
  await page.getByRole('radio', { name: 'Despesa' }).check()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Mercado Geometria E2E')).toBeVisible()

  // Parcelada em mês futuro: a fatura nasce Aberta, então a linha exibe o
  // conjunto máximo de ações (Editar, Adiantar, Excluir) — o pior caso de
  // largura para a coluna.
  const hoje = new Date()
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
  const dataCompra = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`

  await page.getByRole('link', { name: 'Saídas' }).click()
  await page.getByRole('radio', { name: 'Parcelada', exact: true }).click()
  // Descrição longa de propósito: é o pior caso para a largura da tabela.
  await page.getByLabel('Descrição').fill('Notebook Dell comprado em doze vezes sem juros')
  await page.getByLabel('Categoria').selectOption({ label: 'Mercado Geometria E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Geometria E2E' })
  await page.getByLabel('Valor total (R$)').fill('3600,00')
  await page.getByLabel('Total de parcelas').fill('6')
  await page.getByLabel('Data da compra').fill(dataCompra)
  await page.getByRole('button', { name: 'Registrar parcelada' }).click()
  await expect(
    page.getByRole('cell', { name: 'Notebook Dell comprado em doze vezes sem juros' })
  ).toBeVisible()

  return page
}

// 1000 e 1280 cobrem a inversão de breakpoint do detalhe: acima de 1200px o
// aside de 340px derruba a área principal de 698px para 629px, ou seja,
// alargar a janela deixa a tabela mais estreita.
for (const largura of [1000, 1280, 1600] as const) {
  test(`ações da fatura continuam dentro do painel em ${largura}px`, async ({ app }) => {
    const page = await semear(app)
    await redimensionar(app, largura)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Geometria E2E' })
    await page.locator('[class*="faturaMes"]').first().click()

    const linha = page
      .getByRole('row')
      .filter({ hasText: 'Notebook Dell comprado em doze vezes sem juros' })
      .first()
    await expect(linha).toBeVisible()

    // A tabela precisa caber no container que a recorta: o Panel usa
    // overflow:hidden e aqui, diferente de Saídas, não há container rolável —
    // qualquer transbordo vira corte permanente.
    const transbordo = await page.evaluate(() => {
      const tabela = document.querySelector('table')
      if (!tabela) return null
      let cont: HTMLElement | null = tabela.parentElement
      while (cont && getComputedStyle(cont).overflowX === 'visible') cont = cont.parentElement
      return tabela.scrollWidth - (cont?.clientWidth ?? 0)
    })
    expect(transbordo, 'a tabela de parcelas transbordou o painel').toBeLessThanOrEqual(0)

    // E cada botão de ação precisa estar inteiro dentro da borda do container.
    const botoes = linha.getByRole('button')
    const total = await botoes.count()
    expect(total).toBeGreaterThan(0)

    for (let i = 0; i < total; i++) {
      const botao = botoes.nth(i)
      const rotulo = (await botao.textContent())?.trim() || `botão ${i}`
      await expect(botao).toBeInViewport({ ratio: 0.99 })

      const cabe = await botao.evaluate((el) => {
        const tabela = el.closest('table')
        if (!tabela) return false
        let cont: HTMLElement | null = tabela.parentElement
        while (cont && getComputedStyle(cont).overflowX === 'visible') cont = cont.parentElement
        if (!cont) return false
        const b = el.getBoundingClientRect()
        const c = cont.getBoundingClientRect()
        return b.left >= c.left - 0.5 && b.right <= c.right + 0.5
      })
      expect(cabe, `"${rotulo}" foi cortado pela borda do painel`).toBe(true)
    }
  })
}
