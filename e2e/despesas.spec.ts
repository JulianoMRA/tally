import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Despesa única + Fatura', () => {
  test('criar cartão, categoria, despesa na tela Saídas e visualizar fatura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Criar cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões' })).toBeVisible()

    await page.getByLabel('Nome').fill('Inter E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Inter E2E')).toBeVisible()

    // --- Criar categoria Alimentação ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()

    await page.getByLabel('Nome').fill('Alimentação E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Alimentação E2E')).toBeVisible()

    // --- Criar despesa única (form inline na tela Saídas) ---
    await page.getByRole('link', { name: 'Saídas' }).click()
    await expect(page.getByLabel('Descrição')).toBeVisible()

    await page.getByLabel('Descrição').fill('Supermercado E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Alimentação E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    // Seta data_compra para dia 03 (< fechamento 05 → fatura do mesmo mês)
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()

    // Banner de sucesso cita o mês de referência por extenso
    await expect(page.getByText('junho de 2026', { exact: true })).toBeVisible()
    // E a despesa aparece na lista de saídas
    await expect(page.getByRole('cell', { name: 'Supermercado E2E' })).toBeVisible()

    // --- Visualizar fatura ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible()

    await page.getByLabel('Cartão').selectOption({ label: 'Inter E2E' })

    // Fatura 2026-06 deve aparecer na lista como "junho de 2026"
    await expect(page.getByText('junho de 2026', { exact: true })).toBeVisible()

    // Abre detalhe da fatura
    await page.getByText('junho de 2026', { exact: true }).click()

    // Parcela 1/1 com valor R$ 50,00 (espaço pode ser non-breaking → regex tolerante)
    await expect(page.getByText('1/1')).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*50,00/ })).toBeVisible()

    // Total da fatura
    await expect(page.getByText(/^Total$/)).toBeVisible()
  })
})
