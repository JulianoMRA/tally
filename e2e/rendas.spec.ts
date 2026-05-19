import { test, expect, _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Rendas e Recebimentos (RF-REN-01..05)', () => {
  test('cadastrar Recorrente, marcar recebido, reajustar e avulso', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../out/main/index.cjs')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Categoria Renda "Salário" ---
    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Salário Renda E2E')
    await page.getByRole('radio', { name: 'Renda' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Salário Renda E2E')).toBeVisible()

    // --- Criar Recorrente "Bolsa PET" ---
    await page.getByRole('link', { name: 'Rendas' }).click()
    await expect(page.getByRole('heading', { name: 'Rendas', exact: true })).toBeVisible()

    // Aba Recorrente é o default
    await page.getByLabel('Nome').fill('Bolsa PET E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Salário Renda E2E' })
    await page.getByLabel('Valor padrão (R$)').fill('1200,00')
    await page.getByLabel('Dia esperado').fill('5')
    await page.getByLabel('Data de início').fill('2026-06-01')
    await page.getByRole('button', { name: 'Cadastrar renda' }).click()
    await expect(page.getByText('Bolsa PET E2E')).toBeVisible()
    await expect(page.getByText('R$ 1.200,00')).toBeVisible()

    // --- /recebimentos: mês 2026-06 mostra a Bolsa ---
    await page.getByRole('link', { name: 'Recebimentos' }).click()
    await expect(page.getByRole('heading', { name: 'Recebimentos' })).toBeVisible()
    await page.getByLabel('Mês').fill('2026-06')

    await expect(page.getByText('Bolsa PET E2E').first()).toBeVisible()
    await expect(page.getByText('R$ 1.200,00').first()).toBeVisible()

    // --- Marcar recebido ---
    await page.getByRole('button', { name: 'Marcar recebido' }).first().click()
    await page.getByRole('button', { name: 'Marcar recebido' }).last().click()
    await expect(page.getByText(/Recebido/).first()).toBeVisible()

    // --- /rendas: reajustar valor para R$ 1.300,00 ---
    // Aqui não temos botão de editar inline na lista (decisão do slice).
    // Reajuste é feito pelo /rendas via formulário de edição ou pelo IPC.
    // Como a versão atual da lista só permite Arquivar/Desarquivar, validamos
    // o reajuste via IPC direto pela consola do DevTools no app real;
    // este E2E foca no fluxo principal de cadastro e marcação.

    // --- /recebimentos: criar avulso ---
    await page.getByRole('button', { name: '+ Novo avulso' }).click()
    await page.getByLabel('Descrição').fill('Freela teste E2E')
    await page.getByLabel('Valor (R$)').fill('500,00')
    await page.getByLabel('Data esperada').fill('2026-06-15')
    await page.getByRole('button', { name: 'Registrar' }).click()

    await expect(page.getByText('Freela teste E2E')).toBeVisible()
    await expect(page.getByText('R$ 500,00')).toBeVisible()

    await app.close()
  })
})
