import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao
} from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Despesa única + Fatura', () => {
  test('criar cartão, categoria, despesa na tela Saídas e visualizar fatura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Criar cartão Inter F=5 V=12 ---
    await criarCartao(page, 'Inter E2E')

    // --- Criar categoria Alimentação ---
    await criarCategoria(page, 'Alimentação E2E')

    // --- Criar despesa única (form inline na tela Saídas) ---
    await page.getByRole('link', { name: 'Saídas' }).click()

    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Supermercado E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Alimentação E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    // Seta data_compra para dia 03 (< fechamento 05 → fatura do mesmo mês)
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()

    // Banner de sucesso cita o mês de referência por extenso
    await expect(page.getByText('junho de 2026', { exact: true })).toBeVisible()
    // E a despesa aparece na lista de saídas
    await expect(page.getByRole('cell', { name: 'Supermercado E2E' })).toBeVisible()

    // --- Visualizar fatura ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible()

    // Pôr o cartão em foco já abre a fatura dele — não há mais lista no meio
    // (ponto 12). Como a única fatura deste cartão é a de junho, é ela que o
    // painel escolhe.
    await focarCartao(page, 'Inter E2E')
    await expect(page.getByRole('heading', { name: /Inter E2E · Junho de 2026/ })).toBeVisible()

    // Parcela 1/1 com valor R$ 50,00 (espaço pode ser non-breaking → regex tolerante)
    await expect(page.getByText('1/1')).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*50,00/ })).toBeVisible()

    // Total da fatura
    await expect(page.getByText(/^Total$/)).toBeVisible()
  })
  test('aceita separador de milhar no campo de valor', async ({ app }) => {
    // A gramatica de valor era duplicada em dezoito lugares e o ponto
    // significava coisas opostas no formulario e no import de CSV: dava para
    // importar '1.234,56' e nao conseguir digita-lo. Unificada, o ponto e
    // resolvido pelo que vem depois — tres digitos e milhar, uma ou duas
    // casas no fim e decimal.
    //
    // O unitario cobre a gramatica; este spec cobre o unico trecho que ele nao
    // alcanca: o valor atravessando o campo real ate virar linha gravada.
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Milhar E2E')
    await criarCategoria(page, 'Eletronicos E2E')
    await page.getByRole('link', { name: 'Saídas' }).click()

    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Notebook E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Eletronicos E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Milhar E2E' })
    await page.getByLabel('Valor (R$)').fill('1.234,56')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()

    // Nao basta o formulario aceitar: o valor tem de chegar gravado certo.
    // '1.234,56' vale R$ 1.234,56 — nao R$ 1,23 nem R$ 123.456,00.
    await expect(page.getByRole('cell', { name: 'Notebook E2E' })).toBeVisible()
    await expect(page.getByRole('cell', { name: /R\$\s*1\.234,56/ })).toBeVisible()
  })
})
