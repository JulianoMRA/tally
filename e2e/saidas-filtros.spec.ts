import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

/**
 * RF-DES-23 — os filtros de Saídas no app real.
 *
 * A lógica está coberta por testes unitários; aqui o que se prova é o caminho
 * inteiro: a recorrente no Pix gravada pelo main aparece em "Fora do cartão", a
 * parcelada gravada em três faturas segue o filtro de categoria mês a mês, e o
 * estado vazio distingue mês sem lançamento de filtro que esconde tudo.
 */

type ApiFiltros = {
  cartao: { create: (i: unknown) => Promise<{ id: number }> }
  categoria: { create: (i: unknown) => Promise<{ id: number }> }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<unknown>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
    criarUnicaForaCartao: (i: unknown) => Promise<unknown>
    criarAssinaturaForaCartao: (i: unknown) => Promise<unknown>
  }
}

/**
 * Junho de 2026, num cartão que fecha no dia 25: compras até o dia 10 caem na
 * fatura do próprio mês. A parcelada em 3x ocupa junho, julho e agosto.
 */
async function semear(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(async () => {
    const api = (window as unknown as { api: ApiFiltros }).api
    const cartao = await api.cartao.create({
      nome: 'Inter Filtros',
      diaFechamento: 25,
      diaVencimento: 5,
      cor: '#a88454'
    })
    const mercado = await api.categoria.create({ nome: 'Mercado Filtros', cor: '#5b7a5e' })
    const lazer = await api.categoria.create({ nome: 'Lazer Filtros', cor: '#8c3b2e' })

    await api.despesa.criarUnicaCredito({
      descricao: 'Compra no credito',
      categoriaId: mercado.id,
      cartaoId: cartao.id,
      valorCentavos: 12000,
      dataCompra: '2026-06-03'
    })
    await api.despesa.criarParceladaCredito({
      descricao: 'Show parcelado',
      categoriaId: lazer.id,
      cartaoId: cartao.id,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-05'
    })
    await api.despesa.criarUnicaForaCartao({
      descricao: 'Feira no Pix',
      categoriaId: mercado.id,
      formaPagamento: 'Pix',
      valorCentavos: 8500,
      dataCompra: '2026-06-08'
    })
    await api.despesa.criarAssinaturaForaCartao({
      descricao: 'Aluguel no Pix',
      categoriaId: mercado.id,
      formaPagamento: 'Pix',
      valorMensalCentavos: 150000,
      mesInicial: '2026-06',
      diaCobranca: 10,
      recorreAte: null
    })
  })
  // Os hooks carregaram antes da semente.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

async function abrirSaidasEm(page: Page, mes: string): Promise<void> {
  await irPara(page, 'Saídas')
  await page.getByLabel('Mês', { exact: true }).fill(mes)
}

function linha(page: Page, descricao: string) {
  return page.getByRole('row').filter({ hasText: descricao })
}

test.describe('Saídas — filtros (RF-DES-23)', () => {
  test('as abas somam, e "Fora do cartão" inclui a recorrente no Pix', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await abrirSaidasEm(page, '2026-06')
    await expect(linha(page, 'Aluguel no Pix')).toBeVisible()

    // À vista inclui a compra no crédito E a do Pix; as três abas somam Todas.
    await expect(page.getByRole('radio', { name: 'Todas 4' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'À vista 2' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Parceladas 1' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Assinaturas 1' })).toBeVisible()

    // A recorrente no Pix aparecia no grupo "Fora do cartão" e sumia da aba de
    // mesmo nome, que contava só compra única.
    await page.getByLabel('Filtrar por origem').selectOption({ label: 'Fora do cartão' })
    await expect(linha(page, 'Aluguel no Pix')).toBeVisible()
    await expect(linha(page, 'Feira no Pix')).toBeVisible()
    await expect(linha(page, 'Compra no credito')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'Todas 2' })).toBeVisible()
  })

  test('o filtro de categoria segue a parcelada mês a mês, e limpar devolve tudo', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await semear(page)
    await abrirSaidasEm(page, '2026-06')
    await expect(linha(page, 'Show parcelado')).toBeVisible()

    await page.getByLabel('Filtrar por categoria').selectOption({ label: 'Lazer Filtros' })
    await expect(linha(page, 'Compra no credito')).toHaveCount(0)
    await expect(linha(page, 'Show parcelado')).toContainText('1/3')

    // O filtro fica ao trocar de mês: em julho, a segunda parcela.
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(linha(page, 'Show parcelado')).toContainText('2/3')
    await expect(page.getByLabel('Filtrar por categoria')).toHaveValue(/\d+/)

    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByLabel('Filtrar por categoria')).toHaveValue('')
    await expect(page.getByRole('radio', { name: /^Todas/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  test('o estado vazio distingue mês sem lançamento de filtro que esconde tudo', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await semear(page)
    await abrirSaidasEm(page, '2026-06')
    await expect(linha(page, 'Feira no Pix')).toBeVisible()

    await page.getByLabel('Buscar saídas').fill('nada com este nome')
    await expect(page.getByText('Nenhuma saída para este filtro.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(linha(page, 'Feira no Pix')).toBeVisible()

    await page.getByLabel('Mês', { exact: true }).fill('2026-05')
    await expect(page.getByText('Nenhuma saída em maio de 2026.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Limpar filtros' })).toHaveCount(0)
  })
})
