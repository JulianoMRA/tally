import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao,
  irPara
} from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'
import type { Page } from '@playwright/test'

/**
 * Pagamento parcial de fatura (RF-FAT-07, RN-10).
 *
 * O app só sabia pagar a fatura inteira. Quem pagava uma parte antes do
 * vencimento lançava o pagamento como renda avulsa: a sobra do mês fechava, e a
 * fatura seguia mostrando um valor que o banco já não cobrava.
 *
 * Os dois primeiros casos cobrem os dois status que aceitam pagamento parcial,
 * com datas que não dependem de quando o teste roda: a compra do mês que vem,
 * dia 3, num cartão que fecha no dia 5, nasce numa fatura Aberta em qualquer
 * dia; a de junho/2026 já chega Fechada. O terceiro segue o pagamento para fora
 * da tela de Faturas: a sobra do mês, o card, a agenda e a Simulação (RN-08).
 */

async function lancarCompra(
  page: Page,
  opcoes: { cartao: string; categoria: string; valor: string; data: string }
) {
  await irPara(page, 'Saídas')
  await abrirCadastroDeSaida(page)
  await page.getByLabel('Descrição').fill(`Compra no ${opcoes.cartao}`)
  await page.getByLabel(/^Categoria/).selectOption({ label: opcoes.categoria })
  await page.getByLabel('Cartão').selectOption({ label: opcoes.cartao })
  await page.getByLabel('Valor (R$)').fill(opcoes.valor)
  await page.getByLabel('Data da compra').fill(opcoes.data)
  await page.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova saída' })).toHaveCount(0)
}

/** Data local, como o app (`hojeIsoLocal`): `toISOString` é UTC. */
function hojePorExtenso(): string {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${hoje.getFullYear()}`
}

function faixa(page: Page) {
  return page.getByRole('region', { name: 'Resumo da fatura' })
}

function pagamentos(page: Page) {
  return page.getByRole('region', { name: 'Pagamentos parciais' })
}

async function registrar(page: Page, valor: string) {
  await page.getByRole('button', { name: 'Pagamento parcial' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Registrar pagamento parcial' })
  await expect(dialogo).toBeVisible()
  await dialogo.getByLabel('Valor (R$)').fill(valor)
  return dialogo
}

test.describe('Faturas — pagamento parcial (RF-FAT-07)', () => {
  test('fatura Aberta: registra, mostra o que falta e exclui', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Parcial E2E')
    await criarCategoria(page, 'Casa Parcial E2E')

    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const dataCompra = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
    await lancarCompra(page, {
      cartao: 'Inter Parcial E2E',
      categoria: 'Casa Parcial E2E',
      valor: '800,00',
      data: dataCompra
    })

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Parcial E2E')
    await expect(faixa(page)).toContainText(/Total da fatura\s*R\$\s*800,00/)
    await expect(pagamentos(page)).toHaveCount(0)

    // O diálogo confere com a regra do main antes de habilitar: acima do que
    // falta não é oferecido para falhar depois do clique.
    let dialogo = await registrar(page, '800,01')
    await expect(dialogo.getByText(/passa do que falta pagar/)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled()
    await page.keyboard.press('Escape')

    dialogo = await registrar(page, '200,00')
    await dialogo.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(page.getByText('Pagamento parcial registrado.')).toBeVisible()
    await expect(dialogo).toHaveCount(0)

    // A faixa passa a destacar o que falta; o total continua lá.
    await expect(faixa(page)).toContainText(/Total da fatura\s*R\$\s*800,00/)
    await expect(faixa(page)).toContainText(/Pagamentos parciais\s*R\$\s*200,00/)
    await expect(faixa(page)).toContainText(/Falta pagar\s*R\$\s*600,00/)

    // O card do trilho mostra o que falta, com o parcial como contexto.
    const card = page
      .getByRole('group', { name: 'Cartões' })
      .getByRole('button', { name: /^Inter Parcial E2E/ })
    await expect(card).toContainText(/R\$\s*600,00/)
    await expect(card).toContainText(/R\$\s*200,00 pagos de R\$\s*800,00/)

    // A lista dos pagamentos, com a data de hoje.
    const linha = pagamentos(page).getByRole('row').filter({ hasText: hojePorExtenso() })
    await expect(linha).toContainText(/R\$\s*200,00/)

    // Excluir pede confirmação e devolve o valor ao que falta pagar.
    await acionarNoMenuDaLinha(page, linha, 'Excluir')
    const confirmacao = page.getByRole('dialog', { name: 'Excluir pagamento parcial?' })
    await expect(confirmacao).toContainText(/R\$\s*200,00/)
    await confirmacao.getByRole('button', { name: 'Excluir', exact: true }).click()

    await expect(page.getByText('Pagamento parcial excluído.')).toBeVisible()
    await expect(pagamentos(page)).toHaveCount(0)
    await expect(faixa(page).getByText('Falta pagar')).toHaveCount(0)
    await expect(card).toContainText(/R\$\s*800,00/)
    await expect(card).not.toContainText(/pagos de/)
  })

  test('fatura Fechada: o valor que quita é "Marcar como paga", e reabrir mantém o parcial', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Fechada E2E')
    await criarCategoria(page, 'Casa Fechada E2E')
    // Junho/2026 já fechou (05/06): a fatura chega Fechada ao abrir a tela.
    await lancarCompra(page, {
      cartao: 'Inter Fechada E2E',
      categoria: 'Casa Fechada E2E',
      valor: '120,00',
      data: '2026-06-03'
    })

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Fechada E2E')
    await expect(page.getByRole('button', { name: 'Marcar como paga' })).toBeVisible()

    // Em fatura Fechada, pagar tudo o que falta não é pagamento parcial.
    let dialogo = await registrar(page, '120,00')
    await expect(dialogo.getByText(/Marcar como paga/)).toBeVisible()
    await expect(dialogo.getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled()
    await page.keyboard.press('Escape')

    dialogo = await registrar(page, '50,00')
    await dialogo.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(faixa(page)).toContainText(/Falta pagar\s*R\$\s*70,00/)

    // O diálogo de pagar diz que é o restante que está sendo pago.
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    const pagar = page.getByRole('dialog', { name: 'Marcar fatura como paga' })
    await expect(pagar).toContainText(/falta pagar R\$\s*70,00 de R\$\s*120,00/)
    await pagar.getByRole('button', { name: 'Confirmar pagamento' }).click()

    // Paga: o pagamento parcial segue na lista, e não pode mais ser excluído.
    await expect(page.getByRole('button', { name: 'Reabrir fatura' })).toBeVisible()
    await expect(faixa(page)).toContainText(/Restante pago\s*R\$\s*70,00/)
    await expect(page.getByRole('button', { name: 'Pagamento parcial' })).toHaveCount(0)
    const linha = pagamentos(page).getByRole('row').filter({ hasText: hojePorExtenso() })
    await linha.getByRole('button', { name: /^Mais ações/ }).click()
    await expect(
      page.getByRole('menu').getByRole('menuitem', { name: 'Excluir', exact: true })
    ).toBeDisabled()
    await page.keyboard.press('Escape')

    // Reabrir desfaz o pagamento da fatura, não os parciais.
    await page.getByRole('button', { name: 'Reabrir fatura' }).click()
    const reabrir = page.getByRole('dialog', { name: 'Reabrir fatura?' })
    await expect(reabrir).toContainText(/pagamentos parciais são mantidos/)
    await reabrir.getByRole('button', { name: 'Reabrir', exact: true }).click()

    await expect(faixa(page)).toContainText(/Falta pagar\s*R\$\s*70,00/)
    await expect(
      pagamentos(page).getByRole('row').filter({ hasText: hojePorExtenso() })
    ).toHaveCount(1)
  })

  /**
   * RN-08 com RN-10: a fatura pesa no mês o que falta pagar dela. É o que o
   * improviso da renda avulsa fazia por fora — e o motivo de a feature existir:
   * a sobra certa, sem a renda falsa e com a fatura dizendo a verdade.
   */
  test('o pagamento parcial abate a sobra do mês, o card, a agenda e a Simulação', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Mes E2E')
    await criarCategoria(page, 'Casa Mes E2E')

    // Dia 3 do mês que vem, num cartão que fecha no dia 5: a fatura é a do mês
    // que vem, e segue Aberta em qualquer dia em que o teste rode.
    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const mes = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`
    await lancarCompra(page, {
      cartao: 'Inter Mes E2E',
      categoria: 'Casa Mes E2E',
      valor: '800,00',
      data: `${mes}-03`
    })

    const hero = page.getByRole('region', { name: 'Sobra projetada do mês' })
    const cardDeFaturas = page
      .getByRole('heading', { name: 'Faturas', exact: true })
      .locator('../..')
    const agenda = page.getByRole('heading', { name: 'Ainda vai acontecer' }).locator('../..')

    // Antes do pagamento, o mês pesa o total da fatura.
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill(mes)
    await expect(hero).toContainText(/-R\$\s*800,00/)
    await expect(hero).toContainText('Saídas contam integralmente')
    await expect(agenda).toContainText(/R\$\s*800,00 acumulados/)

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Mes E2E')
    const dialogo = await registrar(page, '200,00')
    await dialogo.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(dialogo).toHaveCount(0)

    // Depois: sobra, fatia do hero, card e agenda passam a contar R$ 600,00.
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill(mes)
    await expect(hero).toContainText(/-R\$\s*600,00/)
    await expect(hero).not.toContainText(/-R\$\s*800,00/)
    // `\s`: a nota usa espaço não-quebrável, para não quebrar em "já / pagos".
    await expect(hero).toContainText(/R\$\s*200,00\sjá\spagos/)
    await expect(hero).toContainText('descontados os pagamentos parciais')

    await expect(cardDeFaturas).toContainText(/R\$\s*600,00/)
    await expect(cardDeFaturas).toContainText(/de R\$\s*800,00/)

    await expect(agenda).toContainText(/R\$\s*600,00 a pagar/)
    await expect(agenda.getByText(/^-R\$\s*600,00$/)).toBeVisible()

    // A Simulação parte da sobra do mês (RN-09): a mesma, já abatida.
    await irPara(page, 'Simulação')
    await page.getByLabel('Mês', { exact: true }).fill(mes)
    await expect(page.locator('[data-saldo-simulado]')).toHaveText(/-R\$\s*600,00/)

    // A folha do PDF fecha a mesma conta sozinha (RF-EXP-02): total, parciais
    // e líquido da fatura, e "Saídas" pelo líquido. Por último, porque a rota
    // de impressão não tem o shell do app.
    await page.evaluate((m) => {
      window.location.hash = `#/print/${m}`
    }, mes)
    const folha = page.locator('[data-print-pronto]')
    await expect(folha.getByRole('columnheader', { name: 'Parciais' })).toBeVisible()
    await expect(folha.getByRole('columnheader', { name: 'Líquido' })).toBeVisible()
    await expect(folha.getByRole('row').filter({ hasText: 'Inter Mes E2E' })).toContainText(
      /R\$\s*800,00.*R\$\s*200,00.*R\$\s*600,00/
    )
    await expect(folha.getByText('Saídas').locator('..')).toContainText(/R\$\s*600,00/)
  })
})
