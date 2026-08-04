import { test, expect } from './fixtures/electron-app'
import type { ElectronApplication, Page } from '@playwright/test'

/**
 * Regressão da fase 12 — as ações da linha ficavam CORTADAS pelo overflow:hidden
 * do Panel quando a tabela excedia a largura disponível, e nenhum teste pegava
 * isso porque os specs existentes só clicam nos botões (o Playwright rola o
 * elemento para a viewport antes de clicar, mascarando o corte).
 *
 * Aqui verificamos geometria: todo botão de ação precisa estar dentro da
 * viewport e não pode ser decepado pela borda do container que rola.
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
  await page.getByLabel('Nome').fill('Inter Acoes E2E')
  await page.getByLabel('Dia de fechamento').fill('5')
  await page.getByLabel('Dia de vencimento').fill('12')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Inter Acoes E2E')).toBeVisible()

  await page.getByRole('link', { name: 'Categorias' }).click()
  await page.getByLabel('Nome').fill('Mercado Acoes E2E')
  await page.getByRole('radio', { name: 'Despesa' }).check()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Mercado Acoes E2E')).toBeVisible()

  await page.getByRole('link', { name: 'Saídas' }).click()

  // Descrição longa de propósito: é o pior caso para a largura da tabela.
  await page.getByLabel('Descrição').fill('Compra grande do mes no supermercado do bairro')
  await page.getByLabel('Categoria').selectOption({ label: 'Mercado Acoes E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Acoes E2E' })
  await page.getByLabel('Valor (R$)').fill('1234,56')
  await page.getByLabel('Data da compra').fill('2026-06-03')
  await page.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(
    page.getByRole('cell', { name: 'Compra grande do mes no supermercado do bairro' })
  ).toBeVisible()

  // Assinatura ativa = 5 botões na linha (pior caso: Duplicar, Nota/Tags,
  // Editar, Cancelar, Excluir).
  await page.getByRole('radio', { name: 'Assinatura', exact: true }).click()
  await page.getByLabel('Descrição').fill('Streaming de video mensal')
  await page.getByLabel('Categoria').selectOption({ label: 'Mercado Acoes E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Acoes E2E' })
  await page.getByLabel('Valor mensal (R$)').fill('39,90')
  await page.getByLabel('Data de início').fill('2026-06-01')
  await page.getByRole('button', { name: 'Registrar assinatura' }).click()
  await expect(page.getByRole('cell', { name: 'Streaming de video mensal' })).toBeVisible()

  return page
}

// Depois da fase 3 do plano de UI/UX a linha tem no máximo dois controles:
// a ação primária (Editar) e o gatilho "⋯". As demais vivem no menu, que é
// renderizado num portal em document.body — justamente porque `.tabelaWrap`
// tem `overflow-x: auto` e recortaria um menu posicionado dentro dela.
const ACOES_NO_MENU = ['Duplicar', 'Nota/Tags', 'Cancelar assinatura', 'Excluir'] as const

// As três larguras cobrem regimes distintos do bug original:
// 1000 — janela clampada por telas pequenas (runner de CI): a tabela não cabe e
//        depende do container rolável;
// 1280 — tamanho padrão da janela (electron/main.ts): cabia por margem de 4px,
//        então funciona como canário — um 6º botão na linha quebra aqui antes
//        de quebrar em qualquer outro lugar;
// 1600 — faixa onde o grid de 2 colunas espremia a lista para ~770px.
for (const largura of [1000, 1280, 1600] as const) {
  test(`ações da linha continuam visíveis e clicáveis em ${largura}px`, async ({ app }) => {
    const page = await semear(app)
    await redimensionar(app, largura)
    // Aguarda o relayout após o setSize antes de medir geometria.
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    const linha = page.getByRole('row').filter({ hasText: 'Streaming de video mensal' })

    // A densidade é o ponto da fase: no máximo 2 controles por linha, contra os
    // 5 de antes. Se voltarem a empilhar botões soltos, este teste cai.
    await expect(linha.getByRole('button')).toHaveCount(2)

    const primaria = linha.getByRole('button', { name: 'Editar', exact: true })
    const gatilho = linha.getByRole('button', { name: /^Mais ações/ })

    for (const controle of [primaria, gatilho]) {
      await controle.scrollIntoViewIfNeeded()
      await expect(controle).toBeInViewport({ ratio: 0.99 })

      // O controle precisa caber inteiro dentro do container que rola: se
      // estiver sendo decepado pela borda, o clique não chega no alvo.
      const cabe = await controle.evaluate((el) => {
        const wrap = el.closest('table')?.parentElement
        if (!wrap) return false
        const b = el.getBoundingClientRect()
        const w = wrap.getBoundingClientRect()
        return b.left >= w.left - 0.5 && b.right <= w.right + 0.5
      })
      expect(cabe, 'controle da linha foi cortado pela borda do container').toBe(true)
    }

    // Todas as ações continuam alcançáveis, agora pelo menu — e o menu não pode
    // ser recortado pelo container que rola no eixo X.
    await gatilho.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    for (const acao of ACOES_NO_MENU) {
      await expect(menu.getByRole('menuitem', { name: acao, exact: true })).toBeVisible()
    }
    await expect(menu).toBeInViewport({ ratio: 0.99 })

    // Prova funcional: o item destrutivo do menu realmente recebe o clique.
    await menu.getByRole('menuitem', { name: 'Excluir', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Streaming de video mensal')
  })
}

// 1280 é a janela padrão (layout empilhado, tabela com a largura inteira) e
// 1440 é a primeira faixa em que a fase 4 liga as duas colunas. A segunda é a
// que importa: foi lá que a medição mostrou que um breakpoint em 1280 deixaria
// a lista com 606px contra os ~698px que a tabela precisa.
for (const largura of [1280, 1440] as const) {
  test(`tabela de Saídas cabe sem rolagem horizontal em ${largura}px`, async ({ app }) => {
    const page = await semear(app)
    await redimensionar(app, largura)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    // Antes da fase 3 a tabela precisava de ~974px, dois terços só de botões, e
    // dependia do container rolável para as ações serem alcançáveis.
    const transbordo = await page.evaluate(() => {
      const tabela = document.querySelector('table')
      const wrap = tabela?.parentElement
      if (!tabela || !wrap) return null
      return tabela.scrollWidth - wrap.clientWidth
    })
    expect(transbordo).not.toBeNull()
    expect(transbordo!, 'tabela transbordou o container').toBeLessThanOrEqual(0)
  })
}
