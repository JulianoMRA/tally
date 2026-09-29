import { test, expect } from './fixtures/electron-app'
import {
  abrirAba,
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  irPara
} from './fixtures/navegacao'

// RF-VIS-05 + RF-VIS-06 + RF-VIS-08 — relatórios: ranking e pizza por categoria + evolução
test.describe('Relatórios e gráficos (RF-VIS-05, RF-VIS-06, RF-VIS-08)', () => {
  test('cadastra 2 despesas em categorias distintas e valida ranking em /relatorios', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Cartão
    await criarCartao(page, 'Inter Rel E2E')

    // Duas categorias
    await criarCategoria(page, 'Mercado E2E')

    await criarCategoria(page, 'Lazer E2E')

    // Duas despesas — mês corrente
    const hoje = new Date()
    const yyyy = hoje.getFullYear()
    const mm = String(hoje.getMonth() + 1).padStart(2, '0')
    const dataMercado = `${yyyy}-${mm}-03`
    const dataLazer = `${yyyy}-${mm}-04`

    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Compra mercado')
    await page.getByLabel(/^Categoria/).selectOption({ label: 'Mercado E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Rel E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill(dataMercado)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra mercado' })).toBeVisible()

    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Cinema')
    await page.getByLabel(/^Categoria/).selectOption({ label: 'Lazer E2E' })
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

    // A pizza voltou como card próprio (RF-VIS-08), com o mesmo dado do
    // ranking e os mesmos percentuais: 80 de 110 e 30 de 110.
    await expect(page.getByRole('heading', { name: 'Divisão dos gastos' })).toBeVisible()
    await expect(
      page.getByRole('img', {
        name: 'Divisão dos gastos por categoria: Mercado E2E 73%, Lazer E2E 27%',
        exact: true
      })
    ).toBeVisible()

    // A legenda leva nome e percentual; o valor em R$ aparece na dica. O hover
    // vai na linha da legenda, não na fatia: o centro da caixa de uma fatia de
    // 73% é o vértice comum a todas, e o alvo ali é ambíguo.
    const legendaMercado = page
      .getByRole('list', { name: 'Legenda' })
      .getByRole('listitem')
      .filter({ hasText: 'Mercado E2E' })
    await expect(legendaMercado).toContainText('73%')
    await legendaMercado.hover()
    await expect(page.getByRole('tooltip')).toContainText(/R\$\s*80,00/)

    // Evolução do saldo continua existindo, agora atrás da aba Análise.
    await abrirAba(page, 'Análise')
    await expect(page.getByRole('heading', { name: 'Evolução do saldo' })).toBeVisible()
  })
})
