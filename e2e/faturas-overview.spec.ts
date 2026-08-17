import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs
// A visão geral sem cartão selecionado deixou de existir: a fusão de lista e
// detalhe (ponto 12) fez a tela abrir já com um cartão em foco e a fatura dele
// aberta. Este spec passou a cobrir o que aquele estado garantia — chegar à
// fatura sem escolher nada, e o deep-link refletindo o que está na tela.
test.describe('Faturas — chegada sem escolher cartão', () => {
  test('abre já com um cartão em foco e a fatura dele, e reflete no deep-link', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões' })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Overview E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Overview E2E')).toBeVisible()

    // --- Categoria ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()
    await page.getByLabel('Nome').fill('Alimentação Overview E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Alimentação Overview E2E')).toBeVisible()

    // --- Despesa no crédito → gera a fatura de junho/2026 ---
    await page.getByRole('link', { name: 'Saídas' }).click()
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Mercado Overview E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Alimentação Overview E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Overview E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('junho de 2026', { exact: true })).toBeVisible()

    // --- Faturas sem escolher nada: o trilho já põe um cartão em foco ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible()

    const trilho = page.getByRole('group', { name: 'Cartões' })
    await expect(trilho.getByRole('button', { name: /^Inter Overview E2E/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // E a fatura desse cartão já está aberta: zero cliques até as parcelas.
    // Junho é a única fatura, e o mês corrente não tem nenhuma — a resolução
    // cai na mais recente do passado.
    await expect(page.getByText('Inter Overview E2E · junho de 2026')).toBeVisible()
    await expect(page.getByText('1/1')).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*80,00/ })).toBeVisible()

    // O deep-link reflete o cartão e a fatura em foco, sem ninguém ter clicado
    expect(page.url()).toMatch(/cartaoId=\d+&faturaId=\d+/)
  })
})
