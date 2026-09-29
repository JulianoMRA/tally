import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

/**
 * RF-DES-14 — agrupar Saídas por categoria.
 *
 * O aceite que só o app inteiro prova: o subtotal de cada seção é o MESMO
 * número que o ranking "Para onde foi" da Visão mensal mostra para a categoria
 * no mesmo mês. As duas telas somam por consultas diferentes — Saídas pelas
 * ocorrências do mês, o ranking por uma agregação no SQL —, e o que garante a
 * igualdade é recortarem o mês pelo mesmo critério. O teste compara os textos
 * das duas telas entre si, sem número escrito à mão no meio.
 */

type ApiAgrupar = {
  cartao: { create: (i: unknown) => Promise<{ id: number }> }
  categoria: {
    create: (i: unknown) => Promise<{ id: number }>
    arquivar: (id: number) => Promise<unknown>
  }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<unknown>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
    criarUnicaForaCartao: (i: unknown) => Promise<unknown>
  }
}

const CATEGORIAS = ['Mercado Grupo', 'Lazer Grupo', 'Viagem Grupo'] as const

/**
 * Junho de 2026, num cartão que fecha no dia 25. Mercado soma R$ 205,00 (uma
 * compra no crédito e uma no Pix), Lazer R$ 100,00 (a primeira de três
 * parcelas) e Viagem R$ 50,00, arquivada depois do lançamento.
 */
async function semear(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(async () => {
    const api = (window as unknown as { api: ApiAgrupar }).api
    const cartao = await api.cartao.create({
      nome: 'Inter Grupo',
      diaFechamento: 25,
      diaVencimento: 5,
      cor: '#a88454'
    })
    const mercado = await api.categoria.create({ nome: 'Mercado Grupo', cor: '#5b7a5e' })
    const lazer = await api.categoria.create({ nome: 'Lazer Grupo', cor: '#8c3b2e' })
    const viagem = await api.categoria.create({ nome: 'Viagem Grupo', cor: '#2f7f7a' })

    await api.despesa.criarUnicaCredito({
      descricao: 'Compra do mes',
      categoriaId: mercado.id,
      cartaoId: cartao.id,
      valorCentavos: 12000,
      dataCompra: '2026-06-03'
    })
    await api.despesa.criarUnicaForaCartao({
      descricao: 'Feira no Pix',
      categoriaId: mercado.id,
      formaPagamento: 'Pix',
      valorCentavos: 8500,
      dataCompra: '2026-06-08'
    })
    await api.despesa.criarParceladaCredito({
      descricao: 'Show parcelado',
      categoriaId: lazer.id,
      cartaoId: cartao.id,
      totalParcelas: 3,
      valorTotalCentavos: 30000,
      dataCompra: '2026-06-05'
    })
    await api.despesa.criarUnicaCredito({
      descricao: 'Passagem',
      categoriaId: viagem.id,
      cartaoId: cartao.id,
      valorCentavos: 5000,
      dataCompra: '2026-06-04'
    })
    await api.categoria.arquivar(viagem.id)
  })
  // Os hooks carregaram antes da semente.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

async function abrirSaidasDeJunho(page: Page): Promise<void> {
  await irPara(page, 'Saídas')
  await page.getByLabel('Mês', { exact: true }).fill('2026-06')
  await expect(page.getByRole('row').filter({ hasText: 'Compra do mes' })).toBeVisible()
}

function secao(page: Page, nome: string) {
  return page.locator('tr[data-grupo]').filter({ hasText: nome })
}

test.describe('Saídas — agrupar por categoria (RF-DES-14)', () => {
  test('as seções seguem a ordem e os valores do ranking da Visão mensal', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await abrirSaidasDeJunho(page)

    await page.getByLabel('Agrupar por').selectOption('categoria')

    // Da maior soma para a menor, e a arquivada com o selo.
    const cabecalhos = page.locator('tr[data-grupo]')
    await expect(cabecalhos).toHaveCount(3)
    await expect(cabecalhos.nth(0)).toContainText('Mercado Grupo')
    await expect(cabecalhos.nth(1)).toContainText('Lazer Grupo')
    await expect(cabecalhos.nth(2)).toContainText('Viagem Grupo')
    await expect(cabecalhos.nth(2)).toContainText('Arquivada')

    // A coluna Categoria repetiria o cabeçalho; entra a Origem no lugar.
    await expect(page.getByRole('columnheader', { name: 'Origem' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Categoria' })).toHaveCount(0)

    const subtotais: Record<string, string> = {}
    for (const nome of CATEGORIAS) {
      subtotais[nome] = (await secao(page, nome).locator('td').nth(1).textContent()) ?? ''
    }
    expect(subtotais['Mercado Grupo']).toMatch(/R\$\s*205,00/)

    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill('2026-06')
    for (const nome of CATEGORIAS) {
      // `ol > li`: o ranking é a lista ordenada. A legenda da pizza, logo ao
      // lado, também lista as categorias — como `ul` —, e um `listitem` pelo
      // nome acharia as duas.
      const linhaDoRanking = page.locator('ol > li').filter({ hasText: nome })
      await expect(linhaDoRanking).toBeVisible()
      const valor = await linhaDoRanking.locator('span.tnum').first().textContent()
      expect(valor, `ranking de ${nome}`).toBe(subtotais[nome])
    }
  })

  test('sem agrupamento, a coluna Origem diz o cartão ou a forma de pagamento', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await abrirSaidasDeJunho(page)

    await page.getByLabel('Agrupar por').selectOption('nenhum')

    await expect(page.locator('tr[data-grupo]')).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Categoria' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Origem' })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Feira no Pix' })).toContainText('Pix')
    await expect(page.getByRole('row').filter({ hasText: 'Compra do mes' })).toContainText(
      'Inter Grupo'
    )
  })
})
