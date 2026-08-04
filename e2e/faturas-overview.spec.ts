import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Faturas — visão geral sem cartão selecionado', () => {
  test('lista faturas de todos os cartões e abre o detalhe pela visão geral', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões' })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Overview E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Overview E2E')).toBeVisible()

    // --- Categoria ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()
    await page.getByLabel('Nome').fill('Alimentação Overview E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Alimentação Overview E2E')).toBeVisible()

    // --- Despesa no crédito → gera a fatura de junho/2026 ---
    await page.getByRole('link', { name: 'Saídas' }).click()
    await expect(page.getByLabel('Descrição')).toBeVisible()
    await page.getByLabel('Descrição').fill('Mercado Overview E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Alimentação Overview E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Overview E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('junho de 2026', { exact: true })).toBeVisible()

    // --- Faturas SEM selecionar cartão: a visão geral aparece ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible()

    // Painel da visão geral leva o nome do cartão e mostra a fatura do mês
    await expect(page.getByRole('heading', { name: 'Inter Overview E2E' })).toBeVisible()
    const item = page.getByText('Junho de 2026', { exact: true })
    await expect(item).toBeVisible()

    // --- Abre o detalhe diretamente pela visão geral ---
    await item.click()
    await expect(page.getByText('1/1')).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*80,00/ })).toBeVisible()

    // O deep-link reflete o cartão e a fatura selecionados
    expect(page.url()).toMatch(/cartaoId=\d+&faturaId=\d+/)
  })
})
