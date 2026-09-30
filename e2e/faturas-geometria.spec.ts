import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao,
  irPara
} from './fixtures/navegacao'
import type { ElectronApplication, Locator, Page } from '@playwright/test'

/**
 * Uma borda direita só na tela de Faturas (R14 do plano de Faturas).
 *
 * O detalhe tinha teto de 880px empilhado e 1280px lado a lado, enquanto a
 * navegação de mês e o histórico ocupavam a largura toda: na janela maximizada
 * a tabela terminava em x≈1590 e "outubro de 2026 →" em x≈1797. O jsdom não faz
 * layout, então o aceite é geométrico: a faixa de resumo, o painel de parcelas
 * e o histórico terminam na mesma borda, com tolerância de 1px.
 */

async function redimensionar(app: ElectronApplication, largura: number) {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0]?.setSize(w, 900)
  }, largura)
}

async function lancar(page: Page, descricao: string, dataCompra: string) {
  await irPara(page, 'Saídas')
  await abrirCadastroDeSaida(page)
  await page.getByLabel('Descrição').fill(descricao)
  await page.getByLabel(/^Categoria/).selectOption({ label: 'Mercado Borda E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Borda E2E' })
  await page.getByLabel('Valor (R$)').fill('75,00')
  await page.getByLabel('Data da compra').fill(dataCompra)
  await page.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova saída' })).toHaveCount(0)
}

/** Painel = `div.panel > div.head > h3`: o título sobe dois níveis até a caixa. */
function painel(page: Page, titulo: string): Locator {
  return page.getByRole('heading', { name: titulo, exact: true }).locator('../..')
}

async function bordaDireita(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('elemento sem caixa')
  return caixa.x + caixa.width
}

for (const largura of [1024, 1280, 1760] as const) {
  test(`faixa, parcelas e histórico terminam na mesma borda em ${largura}px`, async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Borda E2E')
    await criarCategoria(page, 'Mercado Borda E2E')
    // Junho vai para o histórico; a compra do mês que vem abre o painel.
    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const proxima = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
    await lancar(page, 'Compra antiga', '2026-06-03')
    await lancar(page, 'Compra nova', proxima)

    await redimensionar(app, largura)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Borda E2E')

    const faixa = page.getByRole('region', { name: 'Resumo da fatura' })
    const parcelas = painel(page, 'Parcelas')
    const historico = painel(page, 'Histórico deste cartão')
    await expect(faixa).toBeVisible()
    await expect(historico).toBeVisible()

    const referencia = await bordaDireita(parcelas)
    expect(Math.abs((await bordaDireita(faixa)) - referencia)).toBeLessThanOrEqual(1)
    expect(Math.abs((await bordaDireita(historico)) - referencia)).toBeLessThanOrEqual(1)

    // E nada da página passa da largura da janela.
    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(rolagem, 'a página rolou na horizontal').toBeLessThanOrEqual(0)
  })
}
