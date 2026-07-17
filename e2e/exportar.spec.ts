import { test, expect } from './fixtures/electron-app'

// Fase 9 — a rota #/print/:mes alimenta o printToPDF da janela oculta do main.
// Os fluxos de salvar CSV/PDF usam dialog nativo (nao automatizavel); a
// serializacao e coberta por testes de integracao em src/persistence.
test.describe('Exportação — rota de impressão', () => {
  test('renderiza o relatório do mês com dados e o marcador de pronto', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Seed via UI: categoria + gasto Pix em junho/2026
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Print E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Print E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Saídas' }).click()
    await page.getByRole('button', { name: 'Pix', exact: true }).click()
    await page.getByLabel('Descrição').fill('Feira Print E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Print E2E' })
    await page.getByLabel('Valor (R$)').fill('42,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()
    await expect(page.getByRole('strong').filter({ hasText: 'Pix' })).toBeVisible()

    // Navega para a rota de impressão
    await page.evaluate(() => {
      window.location.hash = '#/print/2026-06'
    })

    await expect(page.getByRole('heading', { name: /Tally — Junho de 2026/ })).toBeVisible()
    await expect(page.getByText('Feira Print E2E')).toBeVisible()
    await expect(page.getByText(/R\$\s*42,00/).first()).toBeVisible()
    await expect(page.locator('[data-print-pronto]')).toHaveCount(1)
    // Sem o shell do app: a sidebar nao aparece
    await expect(page.getByRole('link', { name: 'Visão mensal' })).toHaveCount(0)
  })

  test('printToPDF gera bytes de PDF a partir da rota de impressão (smoke)', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Replica a mecânica de gerarPdfDoMes (janela oculta + hash da rota de
    // impressão + printToPDF). Sem o preload nesta janela auxiliar, a página
    // renderiza o estado de erro — o que basta para validar o pipeline de PDF.
    const cabecalho = await app.evaluate(async ({ BrowserWindow }) => {
      const principal = BrowserWindow.getAllWindows()[0]
      const base = principal.webContents.getURL().split('#')[0]
      const win = new BrowserWindow({ show: false })
      try {
        await win.loadURL(`${base}#/print/2026-06`)
        await new Promise((r) => setTimeout(r, 1200))
        const pdf = await win.webContents.printToPDF({ printBackground: true })
        return { bytes: pdf.length, magic: pdf.subarray(0, 5).toString('utf8') }
      } finally {
        win.destroy()
      }
    })

    expect(cabecalho.magic).toBe('%PDF-')
    expect(cabecalho.bytes).toBeGreaterThan(1000)
  })

  test('mês inválido mostra erro sem quebrar', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate(() => {
      window.location.hash = '#/print/banana'
    })

    await expect(page.getByText('Mês inválido.')).toBeVisible()
  })
})
