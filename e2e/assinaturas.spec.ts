import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe('Assinatura (RF-DES-04, RF-DES-07, RF-DES-08)', () => {
  test('cadastrar, reajustar e cancelar uma assinatura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Assinatura E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Assinatura E2E')).toBeVisible()

    // --- Categoria Streaming ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Streaming E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Streaming E2E')).toBeVisible()

    // --- Cadastrar assinatura (form inline em Despesas, tipo Assinatura) ---
    await page.getByRole('link', { name: 'Despesas' }).click()
    await expect(page.getByLabel('Descrição')).toBeVisible()
    await page.getByRole('button', { name: 'Assinatura', exact: true }).click()

    await page.getByLabel('Descrição').fill('Spotify E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Assinatura E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('21,90')
    await page.getByLabel('Data de início').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()

    await expect(page.getByText('Spotify E2E')).toBeVisible()
    // Banner cita a primeira referência (junho de 2026) e o cartão
    await expect(page.getByText(/junho de 2026/).first()).toBeVisible()

    // --- Página de assinaturas: ver a assinatura ativa ---
    await page.getByRole('link', { name: 'Assinaturas' }).click()
    await expect(page.getByRole('heading', { name: 'Assinaturas', exact: true })).toBeVisible()
    await expect(page.getByText('Spotify E2E')).toBeVisible()
    await expect(page.getByText(/R\$\s*21,90\/mês/)).toBeVisible()

    // --- Editar: reajusta o valor mensal para R$ 24,90 ---
    await page.getByRole('button', { name: 'Editar' }).click()
    const input = page.getByLabel('Valor mensal (R$)')
    await input.fill('24,90')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(/R\$\s*24,90\/mês/)).toBeVisible()

    // --- Conferir na fatura junho/2026 ---
    await page.getByRole('link', { name: 'Faturas' }).click()
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Assinatura E2E' })
    await page.getByText('junho de 2026').first().click()
    await expect(page.getByText(/R\$\s*24,90/).first()).toBeVisible()

    // --- Cancelar assinatura (ConfirmDialog in-app: botão da linha abre, confirma no diálogo) ---
    await page.getByRole('link', { name: 'Assinaturas' }).click()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await page.getByRole('button', { name: 'Cancelar assinatura' }).click()

    // Após cancelar, lista de ativas fica vazia
    await expect(page.getByText('Você não tem assinaturas ativas.')).toBeVisible()

    // Aba "Canceladas" mostra a Spotify (exact evita colidir com o toast "... cancelada.")
    await page.getByRole('button', { name: 'Canceladas' }).click()
    await expect(page.getByText('Spotify E2E', { exact: true })).toBeVisible()
  })
})
