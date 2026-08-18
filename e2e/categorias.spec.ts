import { test, expect } from './fixtures/electron-app'
import { criarCategoria } from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Categorias CRUD', () => {
  test('criar, editar, arquivar e desarquivar uma categoria', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Criar categoria Mercado ---
    // Mesmo movimento de Cartões: o formulário virou SidePanel sob demanda.
    await criarCategoria(page, 'Mercado')

    const linha = page.getByRole('listitem').filter({ hasText: 'Mercado' })
    await expect(linha.getByText('Despesa', { exact: true })).toBeVisible()

    // --- Editar: renomear para Supermercado ---
    await linha.getByRole('button', { name: 'Editar' }).click()
    const painel = page.getByRole('dialog', { name: 'Editar categoria' })
    await expect(painel).toBeVisible()
    await painel.getByLabel('Nome').fill('Supermercado')
    await painel.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Supermercado')).toBeVisible()

    // --- Arquivar: no menu ⋯ e com confirmação (ponto 14) ---
    await acionarNoMenuDaLinha(page, linha, 'Arquivar')
    const confirmacao = page.getByRole('dialog', { name: 'Arquivar "Supermercado"?' })
    await expect(confirmacao).toBeVisible()
    await confirmacao.getByRole('button', { name: 'Arquivar' }).click()

    // Some da lista padrão
    await expect(page.getByText('Supermercado')).not.toBeVisible()

    // --- Mostrar arquivados ---
    await page.getByLabel('Mostrar arquivados').check()

    await expect(page.getByText('Supermercado')).toBeVisible()
    await expect(page.getByText('Arquivado', { exact: true })).toBeVisible()

    // --- Desarquivar ---
    await page.getByRole('button', { name: 'Desarquivar' }).first().click()

    // Volta na lista sem badge de arquivado
    await expect(page.getByText('Supermercado')).toBeVisible()
    await expect(page.getByText('Arquivado', { exact: true })).not.toBeVisible()
  })
})
