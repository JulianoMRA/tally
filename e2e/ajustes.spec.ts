import { test, expect } from './fixtures/electron-app'

// Ajustes do app (backups + avisos) persistidos em settings.json no userData.
test.describe('Ajustes', () => {
  test('edita, salva e a configuração persiste ao navegar', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Ajustes' }).click()
    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()

    // Defaults carregados
    const retencao = page.getByLabel('Quantidade de backups mantidos')
    await expect(retencao).toHaveValue('10')

    // Edita e salva
    await retencao.fill('15')
    await page.getByLabel(/Fazer backup ao sair/).uncheck()
    await page.getByRole('button', { name: 'Salvar ajustes' }).click()
    await expect(page.getByText('Ajustes salvos.')).toBeVisible()

    // Persistência real: sai da tela e volta — valores vêm do settings.json
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await expect(page.getByLabel('Quantidade de backups mantidos')).toHaveValue('15')
    await expect(page.getByLabel(/Fazer backup ao sair/)).not.toBeChecked()
  })

  test('valor de retenção inválido bloqueia o salvamento', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Ajustes' }).click()
    const retencao = page.getByLabel('Quantidade de backups mantidos')
    await expect(retencao).toHaveValue('10')

    await retencao.fill('0')
    await page.getByRole('button', { name: 'Salvar ajustes' }).click()

    // Sem toast de sucesso; erro de validação exibido pelo Field
    await expect(page.getByText('Ajustes salvos.')).toHaveCount(0)
  })
})
