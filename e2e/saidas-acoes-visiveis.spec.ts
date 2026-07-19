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
  await page.getByRole('button', { name: 'Assinatura', exact: true }).click()
  await page.getByLabel('Descrição').fill('Streaming de video mensal')
  await page.getByLabel('Categoria').selectOption({ label: 'Mercado Acoes E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Acoes E2E' })
  await page.getByLabel('Valor mensal (R$)').fill('39,90')
  await page.getByLabel('Data de início').fill('2026-06-01')
  await page.getByRole('button', { name: 'Registrar assinatura' }).click()
  await expect(page.getByRole('cell', { name: 'Streaming de video mensal' })).toBeVisible()

  return page
}

const ACOES_ASSINATURA = ['Duplicar', 'Nota/Tags', 'Editar', 'Cancelar', 'Excluir'] as const

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

    for (const acao of ACOES_ASSINATURA) {
      const botao = linha.getByRole('button', { name: acao, exact: true })
      await expect(botao).toHaveCount(1)

      // scrollIntoViewIfNeeded rola o container .tabelaWrap — é exatamente o
      // que o browser faz ao navegar por Tab. Antes da correção o Panel tinha
      // overflow:hidden e não havia container rolável, então o botão
      // permanecia fora da viewport.
      await botao.scrollIntoViewIfNeeded()
      await expect(botao).toBeInViewport({ ratio: 0.99 })

      // O botão precisa caber inteiro dentro do container que rola: se estiver
      // sendo decepado pela borda, o clique não chega no alvo.
      const cabe = await botao.evaluate((el) => {
        const wrap = el.closest('table')?.parentElement
        if (!wrap) return false
        const b = el.getBoundingClientRect()
        const w = wrap.getBoundingClientRect()
        return b.left >= w.left - 0.5 && b.right <= w.right + 0.5
      })
      expect(cabe, `"${acao}" foi cortado pela borda do container`).toBe(true)
    }

    // Prova funcional: o último botão da linha realmente recebe o clique.
    await linha.getByRole('button', { name: 'Excluir', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Streaming de video mensal')
  })
}
