import { test, expect } from './fixtures/electron-app'

// RF-DES-09 — Excluir despesa com confirmação; bloqueia se houver parcela paga.
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe('Excluir despesa (RF-DES-09)', () => {
  test('cria assinatura, exclui via AssinaturasPage e confirma que sumiu', async ({ app }) => {
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

    // Cria assinatura
    const hoje = new Date()
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    await page.getByRole('link', { name: 'Despesas' }).click()
    await page.getByRole('button', { name: 'Assinatura', exact: true }).click()
    await page.getByLabel('Descrição').fill('Spotify Excluir E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Excluir E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Excluir E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('20,00')
    await page.getByLabel('Data de início').fill(inicio)
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByText('Spotify Excluir E2E')).toBeVisible()

    // Vai para AssinaturasPage
    await page.getByRole('link', { name: 'Assinaturas' }).click()
    await expect(page.getByText('Spotify Excluir E2E')).toBeVisible()

    // Confirma exclusão via ConfirmDialog in-app: botão da linha abre, botão do diálogo confirma
    await page.getByRole('button', { name: 'Excluir' }).first().click()
    await page.getByRole('button', { name: 'Excluir' }).last().click()

    // Após exclusão, a assinatura não deve mais aparecer (exact evita o toast "... excluída.")
    await expect(page.getByText('Spotify Excluir E2E', { exact: true })).toHaveCount(0)
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

    // Despesa única no cartão (dia 03 <= F=05 → fatura 2026-06)
    await page.getByRole('link', { name: 'Despesas' }).click()
    await page.getByLabel('Descrição').fill('Compra Paga E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Mercado Paga E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Paga E2E' })
    await page.getByLabel('Valor (R$)').fill('80,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Compra Paga E2E')).toBeVisible()

    // Abre o detalhe da fatura
    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Paga E2E' })
    await page.getByText('junho de 2026', { exact: true }).click()
    await expect(page.getByText('1/1')).toBeVisible()

    // Fecha e paga a fatura
    await page.getByRole('button', { name: 'Fechar fatura' }).click()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()

    // Sincronização RN-06: parcela vira Paga e a exclusão é bloqueada na UI
    const excluir = page.getByRole('button', { name: 'Excluir' })
    await expect(excluir).toBeDisabled()

    // Reabrir reverte a parcela para Pendente e libera a exclusão
    await page.getByRole('button', { name: 'Reabrir fatura' }).click()
    await page.getByRole('button', { name: 'Reabrir', exact: true }).click()
    await expect(excluir).toBeEnabled()
  })
})
