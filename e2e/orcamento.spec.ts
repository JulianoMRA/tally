import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
// Bloco D — Orçamento por categoria: definir limite e ver o status (RN ok/alerta/estourado).
test.describe('Orçamento por categoria (Bloco D)', () => {
  test('define limite e mostra progresso/status do gasto realizado', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Orc E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Orc E2E')).toBeVisible()

    // --- Categoria Mercado (Despesa) ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Orc E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Orc E2E')).toBeVisible()

    // --- Despesa única R$ 80,00 em 2026-06-03 → realizado de junho/2026 ---
    await page.getByRole('link', { name: 'Despesas' }).click()
    await page.getByLabel('Descrição').fill('Compra Orc E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Orc E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Orc E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Compra Orc E2E')).toBeVisible()

    // --- Visão mensal (coluna de gráficos): definir limite de R$ 100,00 no mês 2026-06 ---
    await page.getByRole('link', { name: 'Visão mensal' }).click()
    await expect(page.getByRole('heading', { name: 'Visão mensal' })).toBeVisible()
    await page.getByLabel('Mês', { exact: true }).fill('2026-06')

    // Escopa ao painel de Orçamento (a página tem outro select "Categoria").
    // Estrutura do Panel: h3 (título) → div.head → div.panel.
    const orcPanel = page
      .getByRole('heading', { name: 'Orçamento por categoria' })
      .locator('..')
      .locator('..')

    await orcPanel.getByLabel('Categoria').selectOption({ label: 'Mercado Orc E2E' })
    await orcPanel.getByLabel('Limite (R$)').fill('100,00')
    await orcPanel.getByRole('button', { name: 'Definir limite' }).click()

    // Realizado R$ 80,00 de R$ 100,00 → 80% → alerta ("Atenção")
    const linha = orcPanel.getByRole('listitem').filter({ hasText: 'Mercado Orc E2E' })
    await expect(linha).toBeVisible()
    await expect(linha.getByText(/R\$\s*80,00\s*de\s*R\$\s*100,00/)).toBeVisible()
    await expect(linha.getByText(/80%/)).toBeVisible()
    await expect(linha.getByText(/Atenção/)).toBeVisible()

    // --- Remover o limite: a linha some do painel ---
    await linha.getByRole('button', { name: 'Remover' }).click()
    await expect(
      orcPanel.getByText('Nenhum limite definido. Defina um limite por categoria acima.')
    ).toBeVisible()
  })
})
