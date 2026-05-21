import { test, expect, _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// RF-DES-09 — Excluir despesa com confirmação; bloqueia se houver parcela paga.
test.describe('Excluir despesa (RF-DES-09)', () => {
  test('cria assinatura, exclui via AssinaturasPage e confirma que sumiu', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../out/main/index.cjs')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await page.getByLabel('Nome').fill('Inter Excluir E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Excluir E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await page.getByLabel('Nome').fill('Streaming Excluir E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Streaming Excluir E2E')).toBeVisible()

    // Cria assinatura
    const hoje = new Date()
    const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    await page.getByRole('link', { name: 'Nova despesa' }).click()
    await page.getByRole('button', { name: 'Assinatura' }).click()
    await page.getByLabel('Descrição').fill('Spotify Excluir E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Streaming Excluir E2E' })
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Excluir E2E' })
    await page.getByLabel('Valor mensal (R$)').fill('20,00')
    await page.getByLabel('Início').fill(inicio)
    await page.getByRole('button', { name: 'Registrar assinatura' }).click()
    await expect(page.getByText('Spotify Excluir E2E')).toBeVisible()

    // Vai para AssinaturasPage
    await page.getByRole('link', { name: 'Assinaturas' }).click()
    await expect(page.getByText('Spotify Excluir E2E')).toBeVisible()

    // Confirma exclusão via dialog do navegador
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Excluir' }).first().click()

    // Após exclusão, a assinatura não deve mais aparecer
    await expect(page.getByText('Spotify Excluir E2E')).toHaveCount(0)

    await app.close()
  })
})
