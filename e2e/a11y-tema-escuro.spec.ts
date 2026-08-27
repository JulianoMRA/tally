import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { levarFaturasAoFimDoCiclo } from './fixtures/ciclo-de-vida'
import { semear } from './fixtures/seed'

/**
 * Varredura de acessibilidade no tema escuro.
 *
 * Arquivo separado, e não um laço de temas dentro de `a11y.spec.ts`, por dois
 * motivos: o tema é opção de fixture e vale por arquivo, e juntar os dois
 * dobraria o tempo de TODA a varredura — inclusive dos casos de modal, cuja
 * cor não muda de comportamento entre temas.
 *
 * Só os casos onde o tema efetivamente muda o que o axe mede: contraste de
 * texto sobre superfície. As telas com dados cobrem tabela, badge, gráfico e
 * barra de orçamento; o ciclo de vida cobre Fechada, Paga e Projeção.
 *
 * O gate é o mesmo do tema claro: serious/critical quebram, o resto vai para o
 * stdout para triagem.
 */

test.use({ tema: 'escuro' })

const PAGINAS = [
  { link: 'Visão mensal', heading: 'Visão mensal' },
  { link: 'Faturas', heading: 'Faturas' },
  { link: 'Saídas', heading: 'Saídas' },
  { link: 'Rendas', heading: 'Rendas' },
  { link: 'Cartões', heading: 'Cartões' },
  { link: 'Categorias', heading: 'Categorias' },
  { link: 'Importar dados', heading: 'Importar dados' },
  { link: 'Ajustes', heading: 'Ajustes' }
] as const

async function varrer(page: Page, contexto: string): Promise<void> {
  const resultado = await new AxeBuilder({ page }).setLegacyMode(true).analyze()

  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  )
  const leves = resultado.violations.filter(
    (v) => v.impact !== 'serious' && v.impact !== 'critical'
  )
  if (leves.length > 0) {
    console.log(
      `[a11y escuro] ${contexto}: ${leves.length} violação(ões) leve(s):`,
      leves.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`).join(', ')
    )
  }

  expect(
    graves.map((v) => ({
      id: v.id,
      impact: v.impact,
      descricao: v.description,
      alvos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      html: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 200))
    })),
    `violações graves em ${contexto}`
  ).toEqual([])
}

/**
 * Guarda de sanidade. Sem ela, um tema que não subisse faria os oito testes
 * abaixo varrerem o tema CLARO e passarem — uma suíte inteira reportando um
 * gate que nunca rodou.
 */
test('o app sobe de fato no tema escuro', async ({ app }) => {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'escuro')

  const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(fundo, 'o fundo do body precisa ser o --bg do tema escuro').toBe('rgb(23, 20, 14)')
})

test.describe('Acessibilidade no escuro — com dados', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina.link}: sem violações serious ou critical`, async ({ app }) => {
      const { page } = await semear(app)

      await page.getByRole('link', { name: pagina.link }).click()
      await expect(page.getByRole('heading', { name: pagina.heading, exact: true })).toBeVisible()

      await varrer(page, `${pagina.link} (escuro, com dados)`)
    })
  }
})

test.describe('Acessibilidade no escuro — ciclo de vida da fatura', () => {
  for (const pagina of [
    { link: 'Faturas', heading: 'Faturas' },
    { link: 'Visão mensal', heading: 'Visão mensal' }
  ] as const) {
    test(`${pagina.link}: badges Fechada e Paga sem violações`, async ({ app }) => {
      const { page } = await semear(app)
      await levarFaturasAoFimDoCiclo(page)

      await page.getByRole('link', { name: pagina.link }).click()
      await expect(page.getByRole('heading', { name: pagina.heading, exact: true })).toBeVisible()

      await varrer(page, `${pagina.link} (escuro, ciclo de vida)`)
    })
  }
})
