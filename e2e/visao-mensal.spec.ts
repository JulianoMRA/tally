import { test, expect, _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Visão mensal (RF-VIS-01, RF-VIS-02, RN-08)', () => {
  test('consolida dados do mês escolhido', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../out/main/index.cjs')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Tela inicial é /mensal
    await expect(page.getByRole('heading', { name: 'Visão mensal' })).toBeVisible()

    // --- Setup: cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await page.getByLabel('Nome').fill('Inter Mensal E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Mensal E2E')).toBeVisible()

    // Categoria
    await page.getByRole('link', { name: 'Categorias' }).click()
    await page.getByLabel('Nome').fill('Geral Mensal E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Geral Mensal E2E')).toBeVisible()

    // Despesa única R$ 100 em 2026-06-03 → fatura junho/2026
    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await page.getByLabel('Descrição').fill('Compra Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('100,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Compra Mensal E2E')).toBeVisible()

    // Pix R$ 50 em 2026-06-10
    await page.getByRole('button', { name: 'Pix' }).click()
    await page.getByLabel('Descrição').fill('Pix Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()
    await expect(page.getByText('Pix Mensal E2E')).toBeVisible()

    // --- /mensal: filtrar 2026-06 ---
    await page.getByRole('link', { name: 'Visão mensal' }).click()
    await page.getByLabel('Mês').fill('2026-06')

    // Cards devem mostrar valores
    await expect(page.getByText('R$ 100,00').first()).toBeVisible()
    await expect(page.getByText('R$ 50,00').first()).toBeVisible()

    // Tabela "Faturas" deve mostrar Inter
    await expect(page.getByText('Inter Mensal E2E')).toBeVisible()

    // Tabela "Gastos fora de cartão" deve mostrar Pix
    await expect(page.getByText('Pix Mensal E2E')).toBeVisible()

    // Navegar para julho via seta direita
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(page.getByLabel('Mês')).toHaveValue('2026-07')

    await app.close()
  })
})
