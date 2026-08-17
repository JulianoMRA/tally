import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, irPara } from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Assinatura (RF-DES-04, RF-DES-07, RF-DES-08)', () => {
  test('cadastrar, editar e cancelar uma assinatura na tela Saídas', async ({ app }) => {
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

    // --- Cadastrar assinatura (form inline em Saídas, tipo Assinatura) ---
    await page.getByRole('link', { name: 'Saídas' }).click()
    await abrirCadastroDeSaida(page)
    await page.getByRole('radio', { name: 'Assinatura', exact: true }).click()

    await page.getByLabel('Descrição').fill('Spotify E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Assinatura E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('21,90')
    await page.getByLabel('Data de início').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()

    // Banner cita a primeira referência (junho de 2026)
    await expect(page.getByText(/junho de 2026/).first()).toBeVisible()

    // --- Filtro Assinaturas: ver a assinatura ativa ---
    await page.getByRole('radio', { name: 'Assinaturas', exact: true }).click()
    const linha = page.getByRole('row').filter({ hasText: 'Spotify E2E' })
    await expect(linha.getByText(/R\$\s*21,90\/mês/)).toBeVisible()

    // --- Editar: reajusta o valor mensal para R$ 24,90 (modal escopado) ---
    await linha.getByRole('button', { name: 'Editar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar assinatura' })
    await dialog.getByLabel('Valor mensal (R$)').fill('24,90')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Spotify E2E' })
        .getByText(/R\$\s*24,90\/mês/)
    ).toBeVisible()

    // --- Conferir na fatura junho/2026 ---
    await irPara(page, 'Faturas')
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Assinatura E2E' })
    await page.getByText('Junho de 2026').first().click()
    await expect(page.getByText(/R\$\s*24,90/).first()).toBeVisible()

    // --- Cancelar assinatura pela tela Saídas ---
    await irPara(page, 'Saídas')
    await page.getByRole('radio', { name: 'Assinaturas', exact: true }).click()
    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Spotify E2E' }),
      'Cancelar assinatura'
    )
    // O ConfirmDialog usa o mesmo rótulo; o menu já fechou, então não colide.
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar assinatura' }).click()

    // Após cancelar, a linha mostra o badge "Cancelada"
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Spotify E2E' })
        .getByText('Cancelada', { exact: true })
    ).toBeVisible()
  })
})
