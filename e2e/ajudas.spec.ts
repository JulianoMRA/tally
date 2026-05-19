import { test, expect, _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Ajudas (RF-AJU-01..06, RN-05)', () => {
  test('cadastrar contribuidor, vincular ajuda recorrente e ver dashboard', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../out/main/index.cjs')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Ajuda E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Ajuda E2E')).toBeVisible()

    // --- Categoria Streaming ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Streaming Ajuda E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Streaming Ajuda E2E')).toBeVisible()

    // --- Contribuidor Mãe ---
    await page.getByRole('link', { name: 'Contribuidores' }).click()
    await expect(page.getByRole('heading', { name: 'Contribuidores', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mãe Ajuda E2E')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mãe Ajuda E2E')).toBeVisible()

    // --- Cadastrar Spotify Assinatura R$ 50,00 ---
    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await page.getByRole('button', { name: 'Assinatura' }).click()
    await page.getByLabel('Descrição').fill('Spotify Ajuda E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Ajuda E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Ajuda E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('50,00')
    await page.getByLabel('Data de início').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByText('Spotify Ajuda E2E')).toBeVisible()

    // --- Abrir fatura junho/2026 e adicionar ajuda recorrente ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão:').selectOption({ label: 'Inter Ajuda E2E' })
    await page.getByText('2026-06').first().click()

    // Clica no botão + da primeira parcela
    await page.locator('button[aria-label="Adicionar ajuda"]').first().click()
    await page.getByLabel('Contribuidor').selectOption({ label: 'Mãe Ajuda E2E' })
    await page.getByLabel('Valor (R$)').fill('25,00')
    await page.getByLabel(/Replicar nas pr/i).check()
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

    // Chip aparece na linha
    await expect(page.getByText('Mãe Ajuda E2E').first()).toBeVisible()
    await expect(page.getByText(/Líquido/)).toBeVisible()

    // --- Dashboard /ajudas mostra Mãe com total ---
    await page.getByRole('link', { name: 'Ajudas' }).click()
    await expect(page.getByRole('heading', { name: 'A receber por pessoa' })).toBeVisible()
    await expect(page.getByText('Mãe Ajuda E2E')).toBeVisible()

    // Total pendente deve ser 12 * R$ 25,00 = R$ 300,00 (12 ocorrências replicadas)
    await expect(page.getByText('R$ 300,00')).toBeVisible()

    await app.close()
  })
})
