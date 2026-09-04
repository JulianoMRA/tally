import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, criarCategoria, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

const MES = '2026-06'

function saldoSimulado(page: Page) {
  return page.locator('[data-saldo-simulado]')
}

async function adicionarHipotese(
  page: Page,
  descricao: string,
  valor: string,
  vezes?: string
): Promise<void> {
  const form = page.getByRole('form', { name: 'Nova hipótese' })
  await form.getByLabel('Descrição').fill(descricao)
  await form.getByLabel('Valor').fill(valor)
  if (vezes) await form.getByLabel('Vezes no mês').fill(vezes)
  await form.getByRole('button', { name: 'Adicionar' }).click()
}

test.describe('Simulação (RF-SIM, RN-09)', () => {
  test('calcula hipóteses ao vivo, persiste e não altera os dados reais', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // --- Dado real: um Pix de R$ 100 em junho/2026. Sobra do mês = -R$ 100,00.
    await criarCategoria(page, 'Geral Simulacao E2E')
    await irPara(page, 'Saídas')
    await abrirCadastroDeSaida(page)
    await page.getByRole('radio', { name: 'Pix', exact: true }).click()
    await page.getByLabel('Descrição').fill('Pix Simulacao E2E')
    await page.getByLabel('Categoria').selectOption({ label: 'Geral Simulacao E2E' })
    await page.getByLabel('Valor (R$)').fill('100,00')
    await page.getByLabel('Data da compra').fill('2026-06-10')
    await page.getByRole('button', { name: 'Registrar pix' }).click()
    await expect(page.getByRole('cell', { name: 'Pix Simulacao E2E' })).toBeVisible()

    // --- Simulação parte do saldo do mês (RF-SIM-03).
    await irPara(page, 'Simulação')
    await page.getByLabel('Mês', { exact: true }).fill(MES)
    await expect(saldoSimulado(page)).toHaveText(/-R\$\s*100,00/)

    // --- Uma saída de 50 repetida 2 vezes derruba o saldo em 100 (RN-09).
    await adicionarHipotese(page, 'Fim de semana E2E', '50,00', '2')
    await expect(saldoSimulado(page)).toHaveText(/-R\$\s*200,00/)

    // --- Uma entrada levanta o saldo.
    await adicionarHipotese(page, 'Freela E2E', '300,00')
    await page.getByLabel('Tipo de Freela E2E').selectOption('entrada')
    await expect(saldoSimulado(page)).toHaveText(/R\$\s*100,00/)

    // --- Desligar tira da conta sem tirar da lista (RF-SIM-04).
    await page.getByLabel('Incluir Fim de semana E2E na conta').uncheck()
    await expect(saldoSimulado(page)).toHaveText(/R\$\s*200,00/)
    await expect(page.getByLabel('Valor de Fim de semana E2E')).toBeVisible()
    await page.getByLabel('Incluir Fim de semana E2E na conta').check()
    await expect(saldoSimulado(page)).toHaveText(/R\$\s*100,00/)

    // --- Base digitada substitui o saldo do mês.
    await page.getByRole('radio', { name: 'Valor que eu digito' }).click()
    await page.getByLabel('Tenho na conta').fill('500,00')
    await expect(saldoSimulado(page)).toHaveText(/R\$\s*700,00/)

    // --- Sai da tela e volta: a simulação continua lá (RF-SIM-06).
    await irPara(page, 'Visão mensal')
    await irPara(page, 'Simulação')
    await page.getByLabel('Mês', { exact: true }).fill(MES)
    await expect(saldoSimulado(page)).toHaveText(/R\$\s*700,00/)
    await expect(page.getByLabel('Valor de Fim de semana E2E')).toHaveValue('50,00')

    // --- O que sustenta a promessa da tela: nada disso virou dado real.
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill(MES)
    await expect(page.getByText('Pix Simulacao E2E')).toBeVisible()
    await expect(page.getByText('Fim de semana E2E')).toHaveCount(0)
    await expect(page.getByText('Freela E2E')).toHaveCount(0)

    await irPara(page, 'Saídas')
    await page.getByLabel('Mês', { exact: true }).fill(MES)
    await expect(page.getByRole('cell', { name: 'Pix Simulacao E2E' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fim de semana E2E' })).toHaveCount(0)

    await irPara(page, 'Rendas')
    await expect(page.getByText('Freela E2E')).toHaveCount(0)
  })

  test('outro mês tem a própria lista, e limpar zera só o mês exibido', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await irPara(page, 'Simulação')
    await page.getByLabel('Mês', { exact: true }).fill(MES)
    await adicionarHipotese(page, 'Junho', '40,00')
    await expect(saldoSimulado(page)).toHaveText(/-R\$\s*40,00/)

    // Julho nasce vazio, sem herdar a hipótese de junho (RF-SIM-02).
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(page.getByText('Nenhuma hipótese ainda')).toBeVisible()
    await adicionarHipotese(page, 'Julho', '70,00')
    await expect(saldoSimulado(page)).toHaveText(/-R\$\s*70,00/)

    // Limpar julho não toca em junho.
    await page.getByRole('button', { name: 'Limpar simulação' }).click()
    await page.getByRole('button', { name: 'Limpar', exact: true }).click()
    await expect(page.getByText('Nenhuma hipótese ainda')).toBeVisible()

    await page.getByRole('button', { name: 'Mês anterior' }).click()
    await expect(page.getByLabel('Valor de Junho')).toHaveValue('40,00')
    await expect(saldoSimulado(page)).toHaveText(/-R\$\s*40,00/)
  })
})
