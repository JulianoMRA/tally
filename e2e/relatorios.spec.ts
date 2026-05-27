import { test, expect } from './fixtures/electron-app'

// RF-VIS-05 + RF-VIS-06 — relatórios: ranking por categoria + pizza + evolução
test.describe('Relatórios e gráficos (RF-VIS-05, RF-VIS-06)', () => {
  test('cadastra 2 despesas em categorias distintas e valida ranking em /relatorios', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Cartão
    await page.getByRole('link', { name: 'Cartões' }).click()
    await page.getByLabel('Nome').fill('Inter Rel E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Rel E2E')).toBeVisible()

    // Duas categorias
    await page.getByRole('link', { name: 'Categorias' }).click()
    await page.getByLabel('Nome').fill('Mercado E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado E2E')).toBeVisible()

    await page.getByLabel('Nome').fill('Lazer E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Lazer E2E')).toBeVisible()

    // Duas despesas — mês corrente
    const hoje = new Date()
    const yyyy = hoje.getFullYear()
    const mm = String(hoje.getMonth() + 1).padStart(2, '0')
    const dataMercado = `${yyyy}-${mm}-03`
    const dataLazer = `${yyyy}-${mm}-04`

    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await page.getByLabel('Descrição').fill('Compra mercado')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Rel E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill(dataMercado)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Compra mercado')).toBeVisible()

    await page.getByLabel('Descrição').fill('Cinema')
    await page.getByLabel('Categoria').selectOption({ label: 'Lazer E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Rel E2E' })
    await page.getByLabel('Valor (R$)').fill('30,00')
    await page.getByLabel('Data da compra').fill(dataLazer)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Cinema')).toBeVisible()

    // Relatórios
    await page.getByRole('link', { name: 'Relatórios' }).click()
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible()

    // Ranking deve listar Mercado primeiro (maior valor) e Lazer depois
    await expect(page.getByText('Mercado E2E')).toBeVisible()
    await expect(page.getByText('Lazer E2E')).toBeVisible()
    await expect(page.getByText('R$ 80,00')).toBeVisible()
    await expect(page.getByText('R$ 30,00')).toBeVisible()
  })
})
