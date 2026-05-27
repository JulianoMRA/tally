import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Cartões CRUD', () => {
  test('criar, editar, arquivar e desarquivar um cartão', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Landing page é /mensal desde Slice 11 — navega para Cartões via sidebar
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões' })).toBeVisible()

    // --- Criar cartão Inter ---
    await page.getByLabel('Nome').fill('Inter')
    await page.getByLabel('Dia fechamento').fill('5')
    await page.getByLabel('Dia vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()

    // Aparece na lista
    await expect(page.getByText('Fecha dia 5')).toBeVisible()
    await expect(page.getByText('Inter')).toBeVisible()

    // --- Editar: renomear para Inter Black ---
    await page.getByRole('button', { name: 'Editar' }).first().click()
    await page.getByLabel('Nome').clear()
    await page.getByLabel('Nome').fill('Inter Black')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Inter Black')).toBeVisible()

    // --- Arquivar ---
    await page.getByRole('button', { name: 'Arquivar' }).first().click()

    // Some da lista padrão
    await expect(page.getByText('Inter Black')).not.toBeVisible()

    // --- Mostrar arquivados ---
    await page.getByLabel('Mostrar arquivados').check()

    await expect(page.getByText('Inter Black')).toBeVisible()
    await expect(page.getByText('Arquivado')).toBeVisible()

    // --- Desarquivar ---
    await page.getByRole('button', { name: 'Desarquivar' }).first().click()

    // Volta na lista sem badge
    await expect(page.getByText('Inter Black')).toBeVisible()
    await expect(page.getByText('Arquivado')).not.toBeVisible()
  })
})
