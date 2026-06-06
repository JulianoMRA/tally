import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe.skip('Rendas (RF-REN-01..05) — tela unificada Recebimentos + Fontes', () => {
  test('cadastrar Recorrente na aba Fontes, marcar recebido na aba Recebimentos, criar avulso', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Acessa /rendas ---
    await page.getByRole('link', { name: 'Rendas' }).click()
    await expect(page.getByRole('heading', { name: 'Rendas', exact: true })).toBeVisible()

    // --- Aba "Fontes de renda": criar Recorrente "Bolsa PET" ---
    await page.getByRole('button', { name: 'Fontes de renda' }).click()
    await page.getByLabel('Nome').fill('Bolsa PET E2E')
    await page.getByLabel('Valor padrão (R$)').fill('1200,00')
    await page.getByLabel('Dia esperado').fill('5')
    await page.getByLabel('Data de início').fill('2026-06-01')
    await page.getByRole('button', { name: 'Cadastrar renda' }).click()
    await expect(page.getByText('Bolsa PET E2E')).toBeVisible()
    await expect(page.getByText('R$ 1.200,00')).toBeVisible()

    // --- Aba "Recebimentos do mês": mês 2026-06 mostra a Bolsa ---
    await page.getByRole('button', { name: 'Recebimentos do mês' }).click()
    await page.getByLabel('Mês').fill('2026-06')
    await expect(page.getByText('Bolsa PET E2E').first()).toBeVisible()
    await expect(page.getByText('R$ 1.200,00').first()).toBeVisible()

    // --- Marcar recebido ---
    await page.getByRole('button', { name: 'Marcar recebido' }).first().click()
    await page.getByRole('button', { name: 'Marcar recebido' }).last().click()
    await expect(page.getByText(/Recebido/).first()).toBeVisible()

    // --- Criar avulso pela mesma aba ---
    await page.getByRole('button', { name: '+ Novo avulso' }).click()
    await page.getByLabel('Descrição').fill('Freela teste E2E')
    await page.getByLabel('Valor (R$)').fill('500,00')
    await page.getByLabel('Data esperada').fill('2026-06-15')
    await page.getByRole('button', { name: 'Registrar' }).click()

    await expect(page.getByText('Freela teste E2E')).toBeVisible()
    await expect(page.getByText('R$ 500,00')).toBeVisible()
  })
})
