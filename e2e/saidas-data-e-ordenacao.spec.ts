import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, criarCartao, criarCategoria, irPara } from './fixtures/navegacao'
import type { Page } from '@playwright/test'

/**
 * A coluna Compra e o que ela destrava.
 *
 * A F4 tirou a data da tela argumentando que "a parcela 7/12 não aconteceu em
 * dia nenhum do mês exibido". O argumento valia para AGRUPAR por dia; não valia
 * para exibir. O efeito colateral foi pior que a ausência da coluna: como só
 * sobraram cabeçalhos ordenáveis em Descrição e Neste mês, a ordenação inicial
 * — que sempre foi por data — ficava **inalcançável** depois do primeiro clique
 * em qualquer outra coluna. Só reiniciando o app dava para voltar.
 */

async function semearMes(page: Page): Promise<void> {
  // Fecha dia 28 de propósito: com o fechamento padrão (dia 5), a compra de
  // 20/06 cairia na fatura de JULHO pelo RN-01 e sumiria da lista de junho.
  // As duas compras precisam pertencer ao mesmo mês exibido para a ordenação
  // cronológica ter o que ordenar.
  await criarCartao(page, 'Inter Data E2E', '28', '05')
  await criarCategoria(page, 'Mercado Data E2E')

  await irPara(page, 'Saídas')
  for (const [descricao, valor, dia] of [
    ['Compra do dia tres', '30,00', '03'],
    ['Compra do dia vinte', '10,00', '20']
  ] as const) {
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill(descricao)
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Data E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Data E2E' })
    await page.getByLabel('Valor (R$)').fill(valor)
    await page.getByLabel('Data da compra').fill(`2026-06-${dia}`)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: descricao })).toBeVisible()
  }

  await page.getByLabel('Mês', { exact: true }).fill('2026-06')
}

test.describe('Saídas — coluna Compra', () => {
  test('a data da compra aparece na linha e a coluna abre ordenada por ela', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await semearMes(page)

    await expect(page.getByRole('cell', { name: '03/06/2026' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '20/06/2026' })).toBeVisible()

    // A tela abre ordenada por Compra, decrescente — e agora isso é visível.
    const compra = page.getByRole('columnheader', { name: /Compra/ })
    await expect(compra).toHaveAttribute('aria-sort', 'descending')
  })

  test('a ordenação por Compra continua alcançável depois de ordenar por outra coluna', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await semearMes(page)

    const compra = page.getByRole('columnheader', { name: /Compra/ })
    const valor = page.getByRole('columnheader', { name: /Neste mês/ })

    await valor.getByRole('button').click()
    await expect(valor).toHaveAttribute('aria-sort', 'ascending')
    await expect(compra).toHaveAttribute('aria-sort', 'none')

    // O defeito relatado: daqui não havia volta, porque não existia cabeçalho
    // de data para clicar.
    await compra.getByRole('button').click()
    await expect(compra).toHaveAttribute('aria-sort', 'ascending')
  })

  test('ordenar por Compra achata os grupos, e sair dela devolve o agrupamento', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await semearMes(page)

    const cabecalhoDoCartao = page.getByRole('cell', { name: /Inter Data E2E/ })

    // Ordenado por Compra: bloco único, sem cabeçalho de seção por cartão.
    await expect(cabecalhoDoCartao).toHaveCount(0)

    // Qualquer outra ordenação devolve o agrupamento e o subtotal — sem a
    // volta, o subtotal por cartão seria uma função de mão única.
    await page
      .getByRole('columnheader', { name: /Neste mês/ })
      .getByRole('button')
      .click()
    await expect(cabecalhoDoCartao).toBeVisible()

    await page
      .getByRole('columnheader', { name: /Compra/ })
      .getByRole('button')
      .click()
    await expect(cabecalhoDoCartao).toHaveCount(0)
  })

  // A coluna Tipo saiu: o rótulo da parcela ("à vista", "1/12", "mensal") já
  // diz o mesmo, e o agrupamento por cartão diz o resto.
  test('a coluna Tipo saiu sem levar a informação junto', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await semearMes(page)

    await expect(page.getByRole('columnheader', { name: 'Tipo' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'à vista' }).first()).toBeVisible()
  })
})
