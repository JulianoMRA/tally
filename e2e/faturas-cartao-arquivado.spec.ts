import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao,
  irPara
} from './fixtures/navegacao'
import type { Page } from '@playwright/test'

/**
 * Cartão arquivado com fatura a pagar (RF-CAR-02).
 *
 * Faturas carregava só os cartões ativos. Arquivar um cartão com parcelas
 * correndo — trocar de cartão no meio de uma compra em 12x — tirava as faturas
 * dele da tela, mas não do saldo (RN-08), da Visão mensal nem dos avisos do
 * sistema: ninguém conseguia pagá-las, e o link da Visão mensal caía em outro
 * cartão dizendo que a fatura não existia mais.
 *
 * A compra é retroativa (junho/2026) para a fatura ser de um mês passado e já
 * chegar Fechada — pagável — em qualquer dia em que o teste rode.
 */

async function lancarCompraRetroativa(page: Page, cartao: string, categoria: string) {
  await irPara(page, 'Saídas')
  await abrirCadastroDeSaida(page)
  await page.getByLabel('Descrição').fill(`Compra no ${cartao}`)
  await page.getByLabel(/^Categoria/).selectOption({ label: categoria })
  await page.getByLabel('Cartão').selectOption({ label: cartao })
  await page.getByLabel('Valor (R$)').fill('120,00')
  await page.getByLabel('Data da compra').fill('2026-06-03')
  await page.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova saída' })).toHaveCount(0)
}

/** Arquiva pelo IPC: o fluxo de arquivar já tem spec próprio em `cartoes`. */
async function arquivar(page: Page, nome: string) {
  await page.evaluate(async (alvo) => {
    type Api = {
      cartao: {
        list: () => Promise<{ id: number; nome: string }[]>
        arquivar: (id: number) => Promise<unknown>
      }
    }
    const api = (window as unknown as { api: Api }).api
    const cartao = (await api.cartao.list()).find((c) => c.nome === alvo)
    if (!cartao) throw new Error(`Cartão "${alvo}" não encontrado`)
    await api.cartao.arquivar(cartao.id)
  }, nome)
}

function trilho(page: Page) {
  return page.getByRole('group', { name: 'Cartões' })
}

test.describe('Faturas — cartão arquivado (RF-CAR-02)', () => {
  test('o arquivado com fatura a pagar continua no trilho, e sai depois de pago', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Ativo Arq E2E')
    await criarCartao(page, 'Antigo Arq E2E')
    await criarCategoria(page, 'Mercado Arq E2E')
    await lancarCompraRetroativa(page, 'Antigo Arq E2E', 'Mercado Arq E2E')
    await arquivar(page, 'Antigo Arq E2E')

    await irPara(page, 'Faturas')
    const antigo = trilho(page).getByRole('button', { name: /^Antigo Arq E2E/ })
    await expect(antigo).toContainText('Arquivado')

    await focarCartao(page, 'Antigo Arq E2E')
    await expect(
      page.getByRole('heading', { name: 'Antigo Arq E2E · Junho de 2026' })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Marcar como paga' }).click()
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click()
    await expect(page.getByRole('button', { name: 'Reabrir fatura' })).toBeVisible()

    // Pago, não há mais nada a fazer com ele: numa nova visita, só o ativo.
    await irPara(page, 'Visão mensal')
    await irPara(page, 'Faturas')
    await expect(trilho(page).getByRole('button', { name: /^Ativo Arq E2E/ })).toBeVisible()
    await expect(trilho(page).getByRole('button', { name: /^Antigo Arq E2E/ })).toHaveCount(0)
  })

  test('o link da Visão mensal abre a fatura do cartão arquivado', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // O ativo existe para reproduzir o defeito: sem o arquivado no trilho, a
    // tela caía no primeiro cartão ativo e dizia que a fatura não existia.
    await criarCartao(page, 'Ativo Link E2E')
    await criarCartao(page, 'Antigo Link E2E')
    await criarCategoria(page, 'Mercado Link E2E')
    await lancarCompraRetroativa(page, 'Antigo Link E2E', 'Mercado Link E2E')
    await arquivar(page, 'Antigo Link E2E')

    // O mês vai direto no input (exact: true — "Mês anterior" e "Próximo mês"
    // também casariam), como em `fatura-vencida`.
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill('2026-06')
    await page.getByRole('button', { name: 'Antigo Link E2E' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Faturas')
    await expect(
      page.getByRole('heading', { name: 'Antigo Link E2E · Junho de 2026' })
    ).toBeVisible()
    await expect(trilho(page).getByRole('button', { name: /^Antigo Link E2E/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByText(/não existe mais/)).toHaveCount(0)
  })
})
