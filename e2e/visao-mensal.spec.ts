import { test, expect } from './fixtures/electron-app'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Visão mensal (RF-VIS-01, RF-VIS-02, RN-08)', () => {
  test('consolida dados do mês escolhido', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Tela inicial é /mensal
    await expect(page.getByRole('heading', { name: 'Visão mensal' })).toBeVisible()

    // --- Setup: cartão Inter F=5 V=12 ---
    await page.getByRole('link', { name: 'Cartões' }).click()
    await page.getByLabel('Nome').fill('Inter Mensal E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Mensal E2E')).toBeVisible()

    // Categoria
    await page.getByRole('link', { name: 'Categorias' }).click()
    await page.getByLabel('Nome').fill('Geral Mensal E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Geral Mensal E2E')).toBeVisible()

    // Despesa única R$ 100 em 2026-06-03 → fatura junho/2026
    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await page.getByLabel('Descrição').fill('Compra Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('100,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByText('Compra Mensal E2E')).toBeVisible()

    // Pix R$ 50 em 2026-06-10
    await page.getByRole('button', { name: 'Pix' }).click()
    await page.getByLabel('Descrição').fill('Pix Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()
    await expect(page.getByText('Pix Mensal E2E')).toBeVisible()

    // --- /mensal: filtrar 2026-06 ---
    await page.getByRole('link', { name: 'Visão mensal' }).click()
    await page.getByLabel('Mês').fill('2026-06')

    // Cards devem mostrar valores
    await expect(page.getByText('R$ 100,00').first()).toBeVisible()
    await expect(page.getByText('R$ 50,00').first()).toBeVisible()

    // Tabela "Faturas" deve mostrar Inter
    await expect(page.getByText('Inter Mensal E2E')).toBeVisible()

    // Tabela "Gastos fora de cartão" deve mostrar Pix
    await expect(page.getByText('Pix Mensal E2E')).toBeVisible()

    // Navegar para julho via seta direita
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(page.getByLabel('Mês')).toHaveValue('2026-07')
  })

  test('projeção: navegar além do horizonte estende parcelas e recebimentos (RF-VIS-04, RN-04)', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await page.getByLabel('Nome').fill('Inter Projecao E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Projecao E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await page.getByLabel('Nome').fill('Streaming Projecao E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()

    await page.getByLabel('Nome').fill('Bolsa Projecao E2E')
    await page.getByRole('radio', { name: 'Renda' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Bolsa Projecao E2E')).toBeVisible()

    // Assinatura mensal de R$ 30,00 começando hoje
    const hoje = new Date()
    const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    await page.getByRole('link', { name: 'Assinaturas' }).click()
    await page.getByRole('link', { name: 'Nova assinatura' }).click()
    await page.getByLabel('Descrição').fill('Spotify Projecao E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Projecao E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Projecao E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('30,00')
    await page.getByLabel('Início').fill(isoHoje)
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByText('Spotify Projecao E2E')).toBeVisible()

    // Renda recorrente R$ 800,00 dia 5
    await page.getByRole('link', { name: 'Rendas' }).click()
    await page.getByRole('radio', { name: 'Recorrente' }).check()
    await page.getByLabel('Nome').fill('Bolsa Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Bolsa Projecao E2E' })
    await page.getByLabel('Valor padrão (R$)').fill('800,00')
    await page.getByLabel('Dia esperado').fill('5')
    await page.getByLabel('Início').fill(isoHoje)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Bolsa Mensal E2E')).toBeVisible()

    // Navega para 15 meses adiante (além do horizonte pré-gerado de 12)
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 15, 1)
    const mesAlvo = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`

    await page.getByRole('link', { name: 'Visão mensal' }).click()
    await page.getByLabel('Mês').fill(mesAlvo)

    // Badge "Projeção" visível
    await expect(page.getByText('Projeção')).toBeVisible()

    // Fatura projetada da assinatura aparece
    await expect(page.getByText('Inter Projecao E2E')).toBeVisible()
    await expect(page.getByText('R$ 30,00').first()).toBeVisible()

    // Recebimento projetado
    await expect(page.getByText('R$ 800,00').first()).toBeVisible()
  })
})
