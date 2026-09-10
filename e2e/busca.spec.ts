import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, criarCartao, criarCategoria, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

async function cadastrarUnica(
  page: Page,
  opcoes: { descricao: string; categoria: string; cartao: string; valor: string; data: string }
): Promise<void> {
  await abrirCadastroDeSaida(page)
  const painel = page.getByRole('dialog', { name: 'Nova saída' })
  await painel.getByLabel('Descrição').fill(opcoes.descricao)
  await painel.getByLabel('Categoria').selectOption({ label: opcoes.categoria })
  await painel.getByLabel('Cartão').selectOption({ label: opcoes.cartao })
  await painel.getByLabel('Valor (R$)').fill(opcoes.valor)
  await painel.getByLabel('Data da compra').fill(opcoes.data)
  await painel.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(painel).toHaveCount(0)
}

/**
 * RF-DES-22 — a consulta que atravessa meses.
 *
 * Saídas mostra um mês de cada vez por decisão (RF-DES-14), o que deixava o app
 * sem resposta para "onde está aquela compra de fevereiro" e "quanto gastei com
 * isso no ano".
 */
test.describe('Busca (RF-DES-22)', () => {
  test('encontra lançamentos de meses diferentes, soma o total e respeita o período', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Fecha dia 28: compras no dia 10 caem na fatura do próprio mês, então o
    // mês do resultado é previsível.
    await criarCartao(page, 'Cartao Busca E2E', '28', '5')
    await criarCategoria(page, 'Transporte Busca E2E')

    await irPara(page, 'Saídas')
    for (const [mes, valor] of [
      ['2026-02', '30,00'],
      ['2026-05', '20,00']
    ] as const) {
      await page.getByLabel('Mês', { exact: true }).fill(mes)
      await cadastrarUnica(page, {
        descricao: 'Uber Busca E2E',
        categoria: 'Transporte Busca E2E',
        cartao: 'Cartao Busca E2E',
        valor,
        data: `${mes}-10`
      })
    }
    // Uma fora do assunto, para provar que a peneira de texto pega.
    await page.getByLabel('Mês', { exact: true }).fill('2026-03')
    await cadastrarUnica(page, {
      descricao: 'Mercado Busca E2E',
      categoria: 'Transporte Busca E2E',
      cartao: 'Cartao Busca E2E',
      valor: '99,00',
      data: '2026-03-10'
    })

    await irPara(page, 'Busca')

    // Abre sem varrer o banco: o resultado só aparece depois de pedir.
    await expect(page.getByText('Escolha o período e busque')).toBeVisible()

    await page.getByLabel('Mês inicial').fill('2026-01')
    await page.getByLabel('Mês final').fill('2026-12')
    await page.getByLabel('Descrição contém').fill('uber')
    await page.getByRole('button', { name: 'Buscar' }).click()

    // Duas ocorrências, de meses diferentes, somadas — o que Saídas não faz.
    await expect(page.getByRole('cell', { name: 'fevereiro de 2026' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'maio de 2026' })).toBeVisible()
    await expect(page.getByText('2 lançamentos · R$ 50,00')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Mercado Busca E2E' })).toHaveCount(0)

    // O período recorta: fevereiro fica de fora, maio fica.
    await page.getByLabel('Mês inicial').fill('2026-04')
    await page.getByRole('button', { name: 'Buscar' }).click()
    await expect(page.getByRole('cell', { name: 'fevereiro de 2026' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'maio de 2026' })).toBeVisible()
  })

  test('recusa período invertido antes de consultar o banco', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await irPara(page, 'Busca')

    await page.getByLabel('Mês inicial').fill('2026-12')
    await page.getByLabel('Mês final').fill('2026-01')

    await expect(page.getByText('O mês inicial não pode ser posterior ao final.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeDisabled()
  })
})
