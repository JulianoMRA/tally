import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida } from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// Fase 11 — nota livre e tags nas despesas, exibição e filtro na tela Saídas.
test.describe('Saídas — nota e tags', () => {
  test('adiciona tags a uma despesa, exibe na linha e filtra por tag', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão + categoria
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Tag E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Tag E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Tag E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Tag E2E')).toBeVisible()

    // Duas despesas
    await page.getByRole('link', { name: 'Saídas' }).click()
    for (const [descricao, valor] of [
      ['Hotel viagem', '450,00'],
      ['Padaria', '12,00']
    ] as const) {
      await abrirCadastroDeSaida(page)
      await page.getByLabel('Descrição').fill(descricao)
      await page.getByLabel('Categoria').selectOption({ label: 'Mercado Tag E2E' })
      await page.getByLabel('Cartão').selectOption({ label: 'Inter Tag E2E' })
      await page.getByLabel('Valor (R$)').fill(valor)
      await page.getByLabel('Data da compra').fill('2026-06-03')
      await page.getByRole('button', { name: 'Registrar despesa' }).click()
      await expect(page.getByRole('cell', { name: descricao })).toBeVisible()
    }

    // Abre Nota/Tags do Hotel e adiciona nota + duas tags
    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Hotel viagem' }),
      'Nota/Tags'
    )

    const dialog = page.getByRole('dialog', { name: 'Nota e tags' })
    await dialog.getByLabel('Nota').fill('Reembolsável pelo trabalho')
    await dialog.getByLabel('Nova tag').fill('Viagem')
    await dialog.getByRole('button', { name: 'Adicionar' }).click()
    await dialog.getByLabel('Nova tag').fill('Trabalho')
    await dialog.getByLabel('Nova tag').press('Enter')
    await expect(dialog.getByRole('button', { name: 'Remover tag Viagem' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Remover tag Trabalho' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Nota e tags salvas.')).toBeVisible()

    // As tags aparecem na linha do Hotel (match exato desambigua da descrição)
    const linhaHotel = page.getByRole('row').filter({ hasText: 'Hotel viagem' })
    await expect(linhaHotel.getByText('Viagem', { exact: true })).toBeVisible()
    await expect(linhaHotel.getByText('Trabalho', { exact: true })).toBeVisible()

    // Filtra por "Viagem": Hotel fica, Padaria some
    await page.getByLabel('Filtrar por tag').selectOption('Viagem')
    await expect(page.getByRole('cell', { name: 'Hotel viagem' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Padaria' })).toHaveCount(0)

    // Reabre a modal e confirma que a nota foi persistida
    await page.getByLabel('Filtrar por tag').selectOption('')
    await acionarNoMenuDaLinha(
      page,
      page.getByRole('row').filter({ hasText: 'Hotel viagem' }),
      'Nota/Tags'
    )
    await expect(page.getByRole('dialog', { name: 'Nota e tags' }).getByLabel('Nota')).toHaveValue(
      'Reembolsável pelo trabalho'
    )
  })
})
