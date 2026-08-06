import { test, expect } from './fixtures/electron-app'
import { irPara } from './fixtures/navegacao'

// Importador CSV (migração da planilha): templates fixos, preview com erros
// por linha e importação atômica no main process.
test.describe('Importar dados (CSV)', () => {
  test('importa compras de crédito do CSV e elas aparecem na fatura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Setup: cartão e categoria referenciados pelo nome no CSV
    await page.getByRole('link', { name: 'Cartões' }).click()
    await expect(page.getByRole('heading', { name: 'Cartões', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Inter Import E2E')
    await page.getByLabel('Dia de fechamento').fill('5')
    await page.getByLabel('Dia de vencimento').fill('12')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Inter Import E2E')).toBeVisible()

    await page.getByRole('link', { name: 'Categorias' }).click()
    await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible()
    await page.getByLabel('Nome').fill('Mercado Import E2E')
    await page.getByRole('radio', { name: 'Despesa' }).check()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Mercado Import E2E')).toBeVisible()

    // Importa 2 compras de crédito
    await page.getByRole('link', { name: 'Importar dados' }).click()
    await expect(page.getByRole('heading', { name: 'Importar dados', exact: true })).toBeVisible()
    await page.getByLabel('Tipo de dados').selectOption({
      label: 'Compras únicas no cartão de crédito'
    })

    const csv = [
      'descricao;categoria;cartao;valor;data',
      'Supermercado Import;Mercado Import E2E;Inter Import E2E;180,00;2026-06-02',
      'Farmácia Import;mercado import e2e;inter import e2e;45,50;2026-06-03'
    ].join('\n')
    await page.getByLabel('Arquivo CSV').setInputFiles({
      name: 'compras.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8')
    })

    await expect(page.getByText(/2 linhas válida\(s\)/)).toBeVisible()
    await page.getByRole('button', { name: 'Importar 2 registros' }).click()
    await expect(page.getByText('2 registros importado(s).')).toBeVisible()

    // Confere na fatura de junho do cartão
    await irPara(page, 'Faturas')
    await page.getByLabel('Cartão').selectOption({ label: 'Inter Import E2E' })
    await page.getByText('Junho de 2026', { exact: true }).click()
    await expect(page.getByText('Supermercado Import')).toBeVisible()
    await expect(page.getByText('Farmácia Import')).toBeVisible()
  })

  test('linha inválida aparece no preview com o número e bloqueia a importação', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('link', { name: 'Importar dados' }).click()
    await expect(page.getByRole('heading', { name: 'Importar dados', exact: true })).toBeVisible()
    await page.getByLabel('Tipo de dados').selectOption({
      label: 'Gastos fora de cartão (Pix, débito, dinheiro)'
    })

    const csv = [
      'descricao;categoria;forma_pagamento;valor;data',
      'Almoço;Alimentação;Pix;25,90;2026-07-10',
      'Errada;Alimentação;Cheque;abc;2026-07-10'
    ].join('\n')
    await page.getByLabel('Arquivo CSV').setInputFiles({
      name: 'gastos.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8')
    })

    await expect(page.getByText(/1 linha válida\(s\) e 1 com erro/)).toBeVisible()
    await expect(page.getByRole('cell', { name: '3', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Importar/ })).toBeDisabled()
  })

  test('header errado para o template escolhido mostra erro de arquivo', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await irPara(page, 'Importar dados')
    await page.getByLabel('Tipo de dados').selectOption({
      label: 'Rendas recorrentes (bolsa, salário)'
    })

    await page.getByLabel('Arquivo CSV').setInputFiles({
      name: 'errado.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('descricao;valor\nX;10,00\n', 'utf8')
    })

    await expect(page.getByRole('alert')).toContainText('tally-rendas.csv')
  })
})
