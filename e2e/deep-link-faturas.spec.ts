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

  // Com lista e detalhe fundidos não existe mais um estado vazio para onde
  // cair, nem uma lista atrás para onde "Voltar". Link morto passa a abrir a
  // fatura corrente do cartão e avisar — decisão de ago/2026.
  test('link para fatura inexistente cai na fatura corrente e avisa', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão e uma compra, para haver fatura corrente onde cair ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Morto E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Morto E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Morto E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Morto E2E')).toBeVisible()

    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Compra Morto E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Morto E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Morto E2E' })
    await page.getByLabel('Valor (R$)').fill('90,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra Morto E2E' })).toBeVisible()

    // --- Deep-link apontando para uma fatura que não existe ---
    const cartaoId = await page.evaluate(async () => {
      const api = (
        window as unknown as { api: { cartao: { list: () => Promise<{ id: number }[]> } } }
      ).api
      const cartoes = await api.cartao.list()
      return cartoes[cartoes.length - 1]?.id
    })

    await page.evaluate((id) => {
      window.location.hash = `#/faturas?cartaoId=${id}&faturaId=999999`
    }, cartaoId)

    await expect(page.getByText(/A fatura desse link não existe mais/)).toBeVisible()
    // E a fatura corrente do cartão abriu no lugar, em vez de um beco.
    await expect(page.getByText('Inter Morto E2E · junho de 2026')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0)
  })
})
