import { test, expect } from './fixtures/electron-app'
import { criarCartao } from './fixtures/navegacao'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'

// Requires a prior `npm run build` to generate out/main/index.cjs
test.describe('Cartões CRUD', () => {
  test('criar, editar, arquivar e desarquivar um cartão', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Criar cartão Inter ---
    // O formulário virou SidePanel sob demanda (ponto 16): o fluxo agora começa
    // por "+ Novo cartão", e é isso que o helper encapsula.
    await criarCartao(page, 'Inter')
    await expect(page.getByText('fecha dia 5 · vence dia 12')).toBeVisible()

    const linha = page.getByRole('listitem').filter({ hasText: 'Inter' })

    // --- Editar: renomear para Inter Black ---
    await linha.getByRole('button', { name: 'Editar' }).click()
    const painel = page.getByRole('dialog', { name: 'Editar cartão' })
    await expect(painel).toBeVisible()
    await painel.getByLabel('Nome').fill('Inter Black')
    await painel.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Inter Black')).toBeVisible()

    // --- Arquivar: saiu da linha para o menu ⋯ e passou a pedir confirmação
    // (ponto 14). Antes dividia a linha com Editar, no mesmo peso visual. ---
    await acionarNoMenuDaLinha(page, linha, 'Arquivar')
    const confirmacao = page.getByRole('dialog', { name: 'Arquivar "Inter Black"?' })
    await expect(confirmacao).toBeVisible()
    await confirmacao.getByRole('button', { name: 'Arquivar' }).click()

    // Some da lista padrão
    await expect(page.getByText('Inter Black')).not.toBeVisible()

    // --- Mostrar arquivados ---
    await page.getByLabel('Mostrar arquivados').check()

    await expect(page.getByText('Inter Black')).toBeVisible()
    await expect(page.getByText('Arquivado', { exact: true })).toBeVisible()

    // --- Desarquivar ---
    await page.getByRole('button', { name: 'Desarquivar' }).first().click()

    // Volta na lista sem badge
    await expect(page.getByText('Inter Black')).toBeVisible()
    await expect(page.getByText('Arquivado', { exact: true })).not.toBeVisible()
  })
})
