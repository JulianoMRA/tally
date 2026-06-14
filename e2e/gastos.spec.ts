import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Gastos fora de cartão (RF-DES-01)', () => {
  test('cadastrar Pix na tela Saídas e filtrar por Fora do cartão + mês', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Categoria "Mercado E2E" ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado E2E')).toBeVisible()

    // --- Cadastrar despesa Pix (form inline na tela Saídas) ---
    await page.getByRole('link', { name: 'Saídas' }).click()
    await expect(page.getByLabel('Descrição')).toBeVisible()

    // Aba Única está selecionada por default; trocar forma para Pix
    await page.getByRole('button', { name: 'Pix', exact: true }).click()

    await page.getByLabel('Descrição').fill('Feira E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado E2E' })
    await page.getByLabel('Valor (R$)').fill('35,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()

    // Banner cita Pix
    await expect(page.getByRole('strong').filter({ hasText: 'Pix' })).toBeVisible()

    // --- Filtro "Fora do cartão" mostra a despesa ---
    await page.getByRole('button', { name: 'Fora do cartão', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Feira E2E' })).toBeVisible()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Feira E2E' })
        .getByText(/R\$\s*35,00/)
    ).toBeVisible()

    // --- Sub-filtro de mês: 2026-07 não tem lançamentos ---
    await page.getByLabel('Mês').fill('2026-07')
    await expect(page.getByText('Nenhuma saída para este filtro.')).toBeVisible()
  })
})
