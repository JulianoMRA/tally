import { test, expect } from './fixtures/electron-app'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// Fase 10 — QoL na tela Saídas: busca por descrição e duplicar despesa.
test.describe('Saídas — QoL (busca e duplicar)', () => {
  test('busca filtra por descrição e duplicar pré-preenche o formulário', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão + categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter QoL E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter QoL E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado QoL E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado QoL E2E')).toBeVisible()

    // Duas despesas de crédito com descrições distintas
    await page.getByRole('link', { name: 'Saídas' }).click()
    for (const [descricao, valor, dia] of [
      ['Notebook Dell', '3000,00', '2026-06-03'],
      ['Cafeteria', '18,00', '2026-06-04']
    ] as const) {
      await page.getByLabel('Descrição').fill(descricao)
      await page.getByLabel('Categoria').selectOption({ label: 'Mercado QoL E2E' })
      await page.getByLabel('Cartão').selectOption({ label: 'Inter QoL E2E' })
      await page.getByLabel('Valor (R$)').fill(valor)
      await page.getByLabel('Data da compra').fill(dia)
      await page.getByRole('button', { name: 'Registrar despesa' }).click()
      await expect(page.getByRole('cell', { name: descricao })).toBeVisible()
    }

    // Busca: "cafe" (sem acento) casa só Cafeteria
    await page.getByLabel('Buscar saídas').fill('cafe')
    await expect(page.getByRole('cell', { name: 'Cafeteria' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Notebook Dell' })).toHaveCount(0)

    // Limpa a busca
    await page.getByLabel('Buscar saídas').fill('')
    await expect(page.getByRole('cell', { name: 'Notebook Dell' })).toBeVisible()

    // Duplicar Notebook Dell → form pré-preenchido com "(cópia)" e valor
    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Notebook Dell' }),
      'Duplicar'
    )

    await expect(page.getByLabel('Descrição')).toHaveValue('Notebook Dell (cópia)')
    await expect(page.getByLabel('Valor (R$)')).toHaveValue('3000,00')

    // Completa a data (não copiada) e registra a cópia
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Notebook Dell (cópia)' })).toBeVisible()
  })

  test('duplicar assinatura abre a aba Assinatura pré-preenchida', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Nubank QoL E2E')
    await page.getByLabel('Dia de fechamento').fill('15')
    await page.getByLabel('Dia de vencimento').fill('22')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Nubank QoL E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Lazer QoL E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Lazer QoL E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Saídas' }).click()
    await page.getByRole('radio', { name: 'Assinatura', exact: true }).click()
    await page.getByLabel('Descrição').fill('Streaming QoL')
    await page.getByLabel('Categoria').selectOption({ label: 'Lazer QoL E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Nubank QoL E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('39,90')
    await page.getByLabel('Data de início').fill('2026-06-01')
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByRole('cell', { name: 'Streaming QoL' })).toBeVisible()

    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Streaming QoL' }),
      'Duplicar'
    )

    // A aba Assinatura fica ativa e os campos vêm preenchidos
    await expect(page.getByLabel('Descrição')).toHaveValue('Streaming QoL (cópia)')
    await expect(page.getByLabel('Valor mensal (R$)')).toHaveValue('39,90')
  })
})
