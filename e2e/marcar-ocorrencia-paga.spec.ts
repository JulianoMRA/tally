import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, criarCartao, criarCategoria, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

async function cadastrarRecorrenteNoPix(
  page: Page,
  opcoes: { descricao: string; categoria: string; valor: string; mes: string; dia: string }
): Promise<void> {
  await abrirCadastroDeSaida(page)
  const painel = page.getByRole('dialog', { name: 'Nova saída' })
  await painel.getByRole('radio', { name: 'Assinatura' }).click()
  await painel.getByRole('radio', { name: 'Pix', exact: true }).click()
  await painel.getByLabel('Descrição').fill(opcoes.descricao)
  await painel.getByLabel(/^Categoria/).selectOption({ label: opcoes.categoria })
  await painel.getByLabel('Valor mensal (R$)').fill(opcoes.valor)
  await painel.getByLabel('Primeira cobrança').fill(opcoes.mes)
  await painel.getByLabel('Todo dia').fill(opcoes.dia)
  await painel.getByRole('button', { name: 'Registrar recorrente' }).click()
}

function linhaDe(page: Page, descricao: string) {
  return page.locator('tr', { hasText: descricao }).first()
}

async function abrirMenuDaLinha(page: Page, descricao: string) {
  await linhaDe(page, descricao)
    .getByRole('button', { name: /^Mais ações/ })
    .click()
}

test.describe('Marcar ocorrência sem fatura como paga (RF-DES-21)', () => {
  test('marca, mostra o selo e desfaz — sem tocar na ocorrência do mês seguinte', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCategoria(page, 'Moradia Recorrente RF21')
    await irPara(page, 'Saídas')
    await cadastrarRecorrenteNoPix(page, {
      descricao: 'Aluguel Pix RF21',
      categoria: 'Moradia Recorrente RF21',
      valor: '1500,00',
      mes: '2026-10',
      dia: '10'
    })

    await page.getByLabel('Mês', { exact: true }).fill('2026-10')
    await expect(page.getByRole('cell', { name: 'Aluguel Pix RF21' })).toBeVisible()

    // Antes de marcar não há selo: "Pendente" é o padrão e não se carimba.
    await expect(linhaDe(page, 'Aluguel Pix RF21').getByText('Paga', { exact: true })).toHaveCount(
      0
    )

    await abrirMenuDaLinha(page, 'Aluguel Pix RF21')
    await page.getByRole('menuitem', { name: 'Marcar como paga' }).click()
    await expect(linhaDe(page, 'Aluguel Pix RF21').getByText('Paga', { exact: true })).toBeVisible()

    // A ocorrência de novembro é outra parcela e continua pendente — marcar uma
    // não pode marcar a série.
    await page.getByLabel('Mês', { exact: true }).fill('2026-11')
    await expect(page.getByRole('cell', { name: 'Aluguel Pix RF21' })).toBeVisible()
    await expect(linhaDe(page, 'Aluguel Pix RF21').getByText('Paga', { exact: true })).toHaveCount(
      0
    )

    // A volta (a escotilha que destrava editar e excluir a despesa).
    await page.getByLabel('Mês', { exact: true }).fill('2026-10')
    await abrirMenuDaLinha(page, 'Aluguel Pix RF21')
    await page.getByRole('menuitem', { name: 'Desmarcar pagamento' }).click()
    await expect(linhaDe(page, 'Aluguel Pix RF21').getByText('Paga', { exact: true })).toHaveCount(
      0
    )
  })

  test('compra no crédito não oferece a ação — quem marca é a fatura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Data fixa, como no caso de cima: a compra de 03/10/2026 cai na fatura de
    // outubro (RN-01: dia 3 < fechamento 28), e a lista abre nesse mês. Era a
    // compra "de hoje" em UTC, num cartão que fecha no dia 28: do dia 28 ao fim
    // do mês ela caía na fatura seguinte, e das 21h à meia-noite do último dia
    // "hoje" em UTC já era o mês seguinte — nos dois casos a linha não aparecia
    // no mês corrente, e o teste falhava sem defeito nenhum no app.
    await criarCartao(page, 'Cartao RF21', '28', '5')
    await criarCategoria(page, 'Casa Credito RF21')
    await irPara(page, 'Saídas')

    await abrirCadastroDeSaida(page)
    const painel = page.getByRole('dialog', { name: 'Nova saída' })
    await painel.getByLabel('Descrição').fill('Notebook Credito RF21')
    await painel.getByLabel(/^Categoria/).selectOption({ label: 'Casa Credito RF21' })
    await painel.getByLabel('Cartão').selectOption({ label: 'Cartao RF21' })
    await painel.getByLabel('Valor (R$)').fill('500,00')
    await painel.getByLabel('Data da compra').fill('2026-10-03')
    await painel.getByRole('button', { name: 'Registrar despesa' }).click()

    await page.getByLabel('Mês', { exact: true }).fill('2026-10')
    await expect(page.getByRole('cell', { name: 'Notebook Credito RF21' })).toBeVisible()

    await abrirMenuDaLinha(page, 'Notebook Credito RF21')
    await expect(page.getByRole('menuitem', { name: 'Marcar como paga' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Desmarcar pagamento' })).toHaveCount(0)
  })
})
