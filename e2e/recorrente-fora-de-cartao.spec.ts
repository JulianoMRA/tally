import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { abrirCadastroDeSaida, criarCategoria, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

async function cadastrarRecorrente(
  page: Page,
  opcoes: { descricao: string; categoria: string; valor: string; mes: string; dia: string }
): Promise<void> {
  await abrirCadastroDeSaida(page)
  const painel = page.getByRole('dialog', { name: 'Nova saída' })

  await painel.getByRole('radio', { name: 'Assinatura' }).click()
  await painel.getByRole('radio', { name: 'Pix', exact: true }).click()

  await painel.getByLabel('Descrição').fill(opcoes.descricao)
  await painel.getByLabel('Categoria').selectOption({ label: opcoes.categoria })
  await painel.getByLabel('Valor mensal (R$)').fill(opcoes.valor)
  await painel.getByLabel('Primeira cobrança').fill(opcoes.mes)
  await painel.getByLabel('Todo dia').fill(opcoes.dia)

  await painel.getByRole('button', { name: 'Registrar recorrente' }).click()
}

test.describe('Despesa recorrente fora de cartão (RF-DES-16, RN-08)', () => {
  test('gera ocorrência mês a mês e entra no saldo de cada mês', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCategoria(page, 'Moradia Recorrente E2E')
    await irPara(page, 'Saídas')
    await cadastrarRecorrente(page, {
      descricao: 'Aluguel Recorrente E2E',
      categoria: 'Moradia Recorrente E2E',
      valor: '1500,00',
      mes: '2026-10',
      dia: '10'
    })

    // A ocorrência do mês de início aparece em Saídas.
    await page.getByLabel('Mês', { exact: true }).fill('2026-10')
    await expect(page.getByRole('cell', { name: 'Aluguel Recorrente E2E' })).toBeVisible()

    // E o mês seguinte tem a SUA ocorrência — é o que distingue a recorrente de
    // um gasto único, que apareceria só uma vez.
    await page.getByLabel('Mês', { exact: true }).fill('2026-11')
    await expect(page.getByRole('cell', { name: 'Aluguel Recorrente E2E' })).toBeVisible()

    // --- O que a correção da RN-08 sustenta: a Visão mensal conta a ocorrência
    // em CADA mês, e pelo valor de um mês. Antes a leitura era por despesa e a
    // recorrente teria aparecido só no mês de início.
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill('2026-10')
    await expect(page.getByText('Aluguel Recorrente E2E')).toBeVisible()
    await expect(page.getByText(/R\$\s*1\.500,00/).first()).toBeVisible()

    await page.getByLabel('Mês', { exact: true }).fill('2026-11')
    await expect(page.getByText('Aluguel Recorrente E2E')).toBeVisible()
    await expect(page.getByText(/R\$\s*1\.500,00/).first()).toBeVisible()

    // Um mês anterior ao início não inventa ocorrência.
    await page.getByLabel('Mês', { exact: true }).fill('2026-09')
    await expect(page.getByText('Aluguel Recorrente E2E')).toHaveCount(0)
  })

  test('a data limite encerra a recorrência no mês certo', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCategoria(page, 'Contrato Recorrente E2E')
    await irPara(page, 'Saídas')

    await abrirCadastroDeSaida(page)
    const painel = page.getByRole('dialog', { name: 'Nova saída' })
    await painel.getByRole('radio', { name: 'Assinatura' }).click()
    await painel.getByRole('radio', { name: 'Pix', exact: true }).click()
    await painel.getByLabel('Descrição').fill('Curso Recorrente E2E')
    await painel.getByLabel('Categoria').selectOption({ label: 'Contrato Recorrente E2E' })
    await painel.getByLabel('Valor mensal (R$)').fill('300,00')
    await painel.getByLabel('Primeira cobrança').fill('2026-10')
    await painel.getByLabel('Todo dia').fill('20')

    // "Até uma data": 15/12 com cobrança no dia 20 encerra em novembro, porque
    // 20/12 cairia depois do limite escrito (RF-DES-18).
    await painel.getByRole('radio', { name: 'Até uma data' }).click()
    await painel.getByLabel('Recorrente até').fill('2026-12-15')
    await painel.getByRole('button', { name: 'Registrar recorrente' }).click()

    await page.getByLabel('Mês', { exact: true }).fill('2026-11')
    await expect(page.getByRole('cell', { name: 'Curso Recorrente E2E' })).toBeVisible()

    await page.getByLabel('Mês', { exact: true }).fill('2026-12')
    await expect(page.getByRole('cell', { name: 'Curso Recorrente E2E' })).toHaveCount(0)
  })
})
