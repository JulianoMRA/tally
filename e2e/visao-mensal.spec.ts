import { test, expect } from './fixtures/electron-app'
import {
  abrirAba,
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  irPara
} from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs
// TODO(e2e): realinhar seletores com a UI atual e reativar (drift pre-CI). Ver slice-16.5.
test.describe('Visão mensal (RF-VIS-01, RF-VIS-02, RN-08)', () => {
  test('consolida dados do mês escolhido', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Tela inicial é /mensal
    await expect(page.getByRole('heading', { name: 'Visão mensal' })).toBeVisible()

    // --- Setup: cartão Inter F=5 V=12 ---
    await criarCartao(page, 'Inter Mensal E2E')

    // Categoria
    await criarCategoria(page, 'Geral Mensal E2E')

    // Despesa única R$ 100 em 2026-06-03 → fatura junho/2026
    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByLabel('Descrição').fill('Compra Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('100,00')
    await page.getByLabel('Data da compra').fill('2026-06-03')
    await page.getByRole('button', { name: 'Registrar despesa' }).click()
    await expect(page.getByRole('cell', { name: 'Compra Mensal E2E' })).toBeVisible()

    // Pix R$ 50 em 2026-06-10
    await abrirCadastroDeSaida(page)
    await page.getByRole('radio', { name: 'Pix', exact: true }).click()
    await page.getByLabel('Descrição').fill('Pix Mensal E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Mensal E2E' })
    await page.getByLabel('Valor (R$)').fill('50,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()
    await expect(page.getByRole('cell', { name: 'Pix Mensal E2E' })).toBeVisible()

    // --- /mensal: filtrar 2026-06 ---
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill('2026-06')

    // Cards devem mostrar valores (moeda usa espaço não-quebrável)
    await expect(page.getByText(/R\$\s*100,00/).first()).toBeVisible()
    await expect(page.getByText(/R\$\s*50,00/).first()).toBeVisible()

    // Tabela "Faturas" deve mostrar Inter
    await expect(page.getByText('Inter Mensal E2E')).toBeVisible()

    // Tabela "Gastos fora de cartão" deve mostrar Pix
    await expect(page.getByText('Pix Mensal E2E')).toBeVisible()

    // Navegar para julho via seta direita
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(page.getByLabel('Mês', { exact: true })).toHaveValue('2026-07')
  })

  test('projeção: navegar além do horizonte estende parcelas e recebimentos (RF-VIS-04, RN-04)', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria
    await criarCartao(page, 'Inter Projecao E2E')

    await criarCategoria(page, 'Streaming Projecao E2E')
    await criarCategoria(page, 'Bolsa Projecao E2E', 'Renda')

    // Assinatura mensal de R$ 30,00 começando hoje (form inline em Despesas, tipo Assinatura)
    const hoje = new Date()
    const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByRole('radio', { name: 'Assinatura', exact: true }).click()
    await page.getByLabel('Descrição').fill('Spotify Projecao E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Projecao E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Projecao E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('30,00')
    await page.getByLabel('Data de início').fill(isoHoje)
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByRole('cell', { name: 'Spotify Projecao E2E' })).toBeVisible()

    // Renda recorrente R$ 800,00 dia 5 (aba "Fontes de renda")
    await page.getByRole('link', { name: 'Rendas' }).click()
    await page.getByRole('tab', { name: 'Fontes de renda' }).click()
    await page.getByRole('radio', { name: 'Recorrente' }).click()
    await page.getByLabel('Nome').fill('Bolsa Mensal E2E')
    await page.getByLabel('Valor padrão (R$)').fill('800,00')
    await page.getByLabel('Dia esperado').fill('5')
    await page.getByLabel('Data de início').fill(isoHoje)
    await page.getByRole('button', { name: 'Cadastrar renda' }).click()
    await expect(page.getByText('Bolsa Mensal E2E')).toBeVisible()

    // Navega para 15 meses adiante (além do horizonte pré-gerado de 12)
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 15, 1)
    const mesAlvo = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`

    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill(mesAlvo)

    // Badge "Projeção" visível
    await expect(page.getByText('Projeção').first()).toBeVisible()

    // Fatura projetada da assinatura aparece no painel de Faturas. Locator por
    // role: o nome do cartão também aparece na agenda, em "X fecha" e
    // "Fatura X", e um getByText solto casaria com os três.
    await expect(page.getByRole('button', { name: 'Inter Projecao E2E' })).toBeVisible()
    await expect(page.getByText(/R\$\s*30,00/).first()).toBeVisible()

    // RF-VIS-07 — num mês inteiramente futuro a agenda lista os eventos que
    // sustentam o saldo projetado: o vencimento da fatura e a entrada esperada.
    const agenda = page
      .getByRole('heading', { name: 'Ainda vai acontecer' })
      .locator('..')
      .locator('..')
    await expect(agenda.getByText('Fatura Inter Projecao E2E')).toBeVisible()
    await expect(agenda.getByText('Bolsa Mensal E2E')).toBeVisible()
    await expect(agenda.getByText(/\+R\$\s*800,00/)).toBeVisible()

    // Recebimentos em tabela agora ficam na aba Análise (RF-VIS-02).
    await abrirAba(page, 'Análise')
    await expect(page.getByRole('heading', { name: 'Recebimentos' })).toBeVisible()
    await expect(page.getByText(/R\$\s*800,00/).first()).toBeVisible()
  })
})
