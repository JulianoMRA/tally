import { test, expect } from './fixtures/electron-app'
import type { Page } from '@playwright/test'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// RF-DES-09 — Excluir despesa com confirmação; bloqueia se houver parcela paga.
/**
 * Abre o menu "⋯" da única parcela da fatura e devolve o item Excluir. Desde a
 * fase 3 do plano de UI/UX a ação destrutiva não é mais botão solto na linha.
 */
async function itemExcluirDaParcela(page: Page) {
  await page
    .getByRole('button', { name: /^Mais ações/ })
    .first()
    .click()
  return page.getByRole('menu').getByRole('menuitem', { name: 'Excluir', exact: true })
}

test.describe('Excluir despesa (RF-DES-09)', () => {
  test('cria assinatura, exclui pela tela Saídas e confirma que sumiu', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Excluir E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Excluir E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Streaming Excluir E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Streaming Excluir E2E')).toBeVisible()

    // Cria assinatura na tela Saídas
    const hoje = new Date()
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    await page.getByRole('link', { name: 'Saídas' }).click()
    await page.getByRole('radio', { name: 'Assinatura', exact: true }).click()
    await page.getByLabel('Descrição').fill('Spotify Excluir E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Excluir E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Excluir E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('20,00')
    await page.getByLabel('Data de início').fill(inicio)
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()

    // Filtra Assinaturas e exclui pela linha (ConfirmDialog escopado por role)
    await page.getByRole('radio', { name: 'Assinaturas', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Spotify Excluir E2E' })).toBeVisible()
    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Spotify Excluir E2E' }),
      'Excluir'
    )
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click()

    // Após exclusão, a assinatura não deve mais aparecer na lista
    await expect(page.getByRole('cell', { name: 'Spotify Excluir E2E' })).toHaveCount(0)
  })

  test('pagar fatura marca parcela como Paga e bloqueia exclusão; reabrir libera (RN-06)', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Paga E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Paga E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Paga E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Paga E2E')).toBeVisible()

    // Despesa única com data dinâmica 2 meses no futuro (dia 03 < F=05 → fatura
    // do próprio mês, ainda não vencida) — assim reabrir devolve Aberta e a
    // exclusão é liberada, independente do relógio real.
    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 3)
    const dataCompra = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
    // A lista de faturas capitaliza o mês desde a fase 5 do plano de UI/UX.
    const nomeMes = alvo.toLocaleString('pt-BR', { month: 'long' })
    const labelMes = `${nomeMes[0].toUpperCase()}${nomeMes.slice(1)} de ${alvo.getFullYear()}`

    await page.getByRole('link', { name: 'Saídas' }).click()
    await page.getByLabel('Descrição').fill('Compra Paga E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Paga E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Paga E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill(dataCompra)
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra Paga E2E' })).toBeVisible()

    // Abre o detalhe da fatura
    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Paga E2E' })
    await page.getByText(labelMes, { exact: true }).click()
    await expect(page.getByText('1/1')).toBeVisible()

    // Fecha e paga a fatura
    await page.getByRole('button', { name: 'Fechar fatura' }).click()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()

    // Sincronização RN-06: parcela vira Paga e a exclusão é bloqueada na UI.
    // Excluir é destrutiva, então vive no menu "⋯" da linha desde a fase 3.
    await expect(await itemExcluirDaParcela(page)).toBeDisabled()
    await page.keyboard.press('Escape')

    // Reabrir (fatura não vencida) reverte para Aberta e libera a exclusão
    await page.getByRole('button', { name: 'Reabrir fatura' }).click()
    await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
    await expect(await itemExcluirDaParcela(page)).toBeEnabled()
    await page.keyboard.press('Escape')
  })

  test('reabrir fatura vencida volta como Fechada e mantém exclusão bloqueada (RN-06)', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Vencida E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Vencida E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Vencida E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Vencida E2E')).toBeVisible()

    // Compra retroativa: fatura de junho/2026 já passou do fechamento (2026-06-05)
    await page.getByRole('link', { name: 'Saídas' }).click()
    await page.getByLabel('Descrição').fill('Compra Vencida E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Vencida E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Vencida E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra Vencida E2E' })).toBeVisible()

    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Vencida E2E' })
    await page.getByText('Junho de 2026', { exact: true }).click()
    await expect(page.getByText('1/1')).toBeVisible()

    await page.getByRole('button', { name: 'Fechar fatura' }).click()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()

    await expect(await itemExcluirDaParcela(page)).toBeDisabled()
    await page.keyboard.press('Escape')

    // Reabrir uma fatura vencida resulta em Fechada (não Aberta): a parcela
    // volta a Pendente (item habilita), mas o backend bloqueia a exclusão
    // pela RN-06 — parcela em fatura Fechada preserva o histórico.
    await page.getByRole('button', { name: 'Reabrir fatura' }).click()
    await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
    await expect(page.getByText('Fechada', { exact: true })).toBeVisible()

    const excluir = await itemExcluirDaParcela(page)
    await expect(excluir).toBeEnabled()
    await excluir.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click()
    await expect(page.getByText(/Exclusão bloqueada/)).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Compra Vencida E2E' })).toBeVisible()
  })
})
