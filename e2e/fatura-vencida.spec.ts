import { test, expect } from './fixtures/electron-app'
import type { Page } from '@playwright/test'

/**
 * Selo "vencida há N dias" para faturas Fechadas com vencimento passado.
 *
 * A compra é retroativa (2026-05-03): sua fatura vence em 2026-05-12, uma data
 * fixa no passado — o selo aparece de forma estável independentemente de quando
 * o teste roda. A asserção usa /vencida há/ (não o número de dias) justamente
 * para não depender da distância até hoje.
 */

async function ir(page: Page, link: string) {
  await page.getByRole('link', { name: link }).click()
}

test.describe('Fatura vencida', () => {
  test('mostra o selo na Visão mensal e no detalhe; some quando paga', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await ir(page, 'Cartões')
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Vencida E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Vencida E2E')).toBeVisible()

    await ir(page, 'Categorias')
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Vencida E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Vencida E2E')).toBeVisible()

    // Compra retroativa: fatura de maio/2026, vencimento 2026-05-12 (passado).
    await ir(page, 'Saídas')
    await page.getByLabel('Descrição').fill('Compra retroativa de maio')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Vencida E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Vencida E2E' })
    await page.getByLabel('Valor (R$)').fill('523,40')
    await page.getByLabel('Data da compra').fill('2026-05-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra retroativa de maio' })).toBeVisible()

    // Visão mensal em maio/2026 (jul -> jun -> maio): o card exibe o selo.
    await ir(page, 'Visão mensal')
    await page.getByRole('button', { name: 'Mês anterior' }).click()
    await page.getByRole('button', { name: 'Mês anterior' }).click()
    await expect(page.getByText('Maio de 2026')).toBeVisible()
    await expect(page.getByText(/vencida há \d+ dias?/)).toBeVisible()

    // Detalhe da fatura: o aside de status também exibe o selo.
    await ir(page, 'Faturas')
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Vencida E2E' })
    await page.locator('[class*="faturaMes"]').first().click()
    await expect(page.getByText('Inter Vencida E2E · maio de 2026')).toBeVisible()
    await expect(page.getByText(/vencida há \d+ dias?/)).toBeVisible()

    // A fatura de maio já nasce Fechada (fechamento 05/05 passou). Pagá-la
    // remove o selo: fatura Paga nunca é vencida.
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
    await expect(page.getByText(/vencida há/)).toHaveCount(0)
  })
})
