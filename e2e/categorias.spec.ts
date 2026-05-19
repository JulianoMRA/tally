import { test, expect, _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Categorias CRUD', () => {
  test('criar, editar, arquivar e desarquivar uma categoria', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../out/main/index.cjs')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Navega para /categorias
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()

    // --- Criar categoria Mercado ---
    await page.getByLabel('Nome').fill('Mercado')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()

    // Aparece na lista com badge de tipo
    await expect(page.getByText('Mercado')).toBeVisible()
    await expect(page.getByText('Despesa')).toBeVisible()

    // --- Editar: renomear para Supermercado ---
    await page.getByRole('button', { name: 'Editar' }).first().click()
    await page.getByLabel('Nome').clear()
    await page.getByLabel('Nome').fill('Supermercado')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Supermercado')).toBeVisible()

    // --- Arquivar ---
    await page.getByRole('button', { name: 'Arquivar' }).first().click()

    // Some da lista padrão
    await expect(page.getByText('Supermercado')).not.toBeVisible()

    // --- Mostrar arquivados ---
    await page.getByLabel('Mostrar arquivados').check()

    await expect(page.getByText('Supermercado')).toBeVisible()
    await expect(page.getByText('Arquivado')).toBeVisible()

    // --- Desarquivar ---
    await page.getByRole('button', { name: 'Desarquivar' }).first().click()

    // Volta na lista sem badge de arquivado
    await expect(page.getByText('Supermercado')).toBeVisible()
    await expect(page.getByText('Arquivado')).not.toBeVisible()

    await app.close()
  })
})
