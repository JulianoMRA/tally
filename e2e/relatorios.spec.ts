import { test, expect } from './fixtures/electron-app'
import { abrirAba, abrirCadastroDeSaida, irPara } from './fixtures/navegacao'

// RF-VIS-05 + RF-VIS-06 — relatórios: ranking por categoria + evolução
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe('Relatórios e gráficos (RF-VIS-05, RF-VIS-06)', () => {
  test('cadastra 2 despesas em categorias distintas e valida ranking em /relatorios', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Cartão
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Rel E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Rel E2E')).toBeVisible()

    // Duas categorias
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
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

    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Compra mercado')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Rel E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill(dataMercado)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra mercado' })).toBeVisible()

    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Cinema')
    await page.getByLabel('Categoria').selectOption({ label: 'Lazer E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Rel E2E' })
    await page.getByLabel('Valor (R$)').fill('30,00')
    await page.getByLabel('Data da compra').fill(dataLazer)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Cinema' })).toBeVisible()

    // O ranking subiu para a aba Mês da Visão mensal, sob o título "Para onde
    // foi" — é operação, responde "gastei em quê neste mês". A evolução, que é
    // histórico, ficou na aba Análise.
    await irPara(page, 'Visão mensal')
    await expect(page.getByRole('heading', { name: 'Para onde foi' })).toBeVisible()

    // O nome também aparece nos selects de categoria da página; o item do
    // ranking é o único listitem que também contém o valor em R$.
    const rankingMercado = page
      .getByRole('listitem')
      .filter({ hasText: 'Mercado E2E' })
      .filter({ hasText: 'R$' })
    const rankingLazer = page
      .getByRole('listitem')
      .filter({ hasText: 'Lazer E2E' })
      .filter({ hasText: 'R$' })
    await expect(rankingMercado.getByText(/R\$\s*80,00/)).toBeVisible()
    await expect(rankingLazer.getByText(/R\$\s*30,00/)).toBeVisible()

    // A pizza saiu (RF-VIS-06): dizia o mesmo que o ranking ao lado.
    await expect(page.getByRole('heading', { name: 'Gastos do mês por categoria' })).toHaveCount(0)

    // Evolução do saldo continua existindo, agora atrás da aba Análise.
    await abrirAba(page, 'Análise')
    await expect(page.getByRole('heading', { name: 'Evolução do saldo' })).toBeVisible()
  })
})
