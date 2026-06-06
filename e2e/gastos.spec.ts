import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe.skip('Gastos fora de cartão (RF-DES-01)', () => {
  test('cadastrar Pix e visualizar em /gastos com filtro de mês', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Categoria "Mercado E2E" ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado E2E')).toBeVisible()

    // --- Cadastrar despesa Pix ---
    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await expect(page.getByRole('heading', { name: 'Nova despesa', exact: true })).toBeVisible()

    // Aba Única está selecionada por default; trocar forma para Pix
    await page.getByRole('button', { name: 'Pix' }).click()

    await page.getByLabel('Descrição').fill('Feira E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado E2E' })
    await page.getByLabel('Valor (R$)').fill('35,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()

    // Banner cita Pix e 2026-06
    await expect(page.getByText('Feira E2E')).toBeVisible()
    await expect(page.getByText(/Pix/)).toBeVisible()

    // --- /gastos com mês 2026-06 deve mostrar a despesa ---
    await page.getByRole('link', { name: 'Gastos' }).click()
    await expect(page.getByRole('heading', { name: 'Gastos fora de cartão' })).toBeVisible()
    await page.getByLabel('Mês').fill('2026-06')

    await expect(page.getByText('Feira E2E')).toBeVisible()
    await expect(page.getByText('R$ 35,00')).toBeVisible()

    // --- mês vazio (2026-07) ---
    await page.getByLabel('Mês').fill('2026-07')
    await expect(page.getByText('Nenhum gasto fora de cartão neste mês.')).toBeVisible()
  })
})
