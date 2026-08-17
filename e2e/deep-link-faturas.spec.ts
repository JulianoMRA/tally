import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, focarCartao, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Deep-link de faturas (query string)', () => {
  test('abre o detalhe direto pela URL com cartaoId e faturaId', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Pré-condição: cartão, categoria e despesa para gerar uma fatura ---
    await irPara(page, 'Cartões')
    await page.getByLabel('Nome').fill('Inter Deep E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Deep E2E')).toBeVisible()

    await irPara(page, 'Categorias')
    await page.getByLabel('Nome').fill('Alimentação Deep E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Alimentação Deep E2E')).toBeVisible()

    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Mercado Deep E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Alimentação Deep E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Deep E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Mercado Deep E2E' })).toBeVisible()

    // --- Abre a fatura pelo fluxo normal e captura a URL com deep-link ---
    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Deep E2E')
    await page.getByText('Junho de 2026', { exact: true }).click()
    await expect(page.getByText('1/1')).toBeVisible()

    const hashDetalhe = await page.evaluate(() => window.location.hash)
    expect(hashDetalhe).toMatch(/cartaoId=\d+&faturaId=\d+/)

    // --- Navega para fora e volta pela URL: o detalhe deve reabrir sozinho ---
    await page.getByRole('link', { name: 'Visão mensal' }).click()
    await expect(page.getByText('1/1')).toHaveCount(0)

    await page.evaluate((h) => {
      window.location.hash = h
    }, hashDetalhe)

    await expect(page.getByText('1/1')).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*50,00/ })).toBeVisible()
  })

  test('mostra estado vazio quando a fatura do deep-link não existe', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate(() => {
      window.location.hash = '#/faturas?cartaoId=999&faturaId=999'
    })

    await expect(page.getByText('Fatura não encontrada')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
  })
})
