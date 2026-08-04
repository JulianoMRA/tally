import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { acionarNoMenuDaLinha } from './fixtures/acoes-de-linha'
import { semear } from './fixtures/seed'

// Varredura de acessibilidade (axe-core) nas telas principais.
// Gate: violacoes de impacto serious/critical quebram o teste; moderate/minor
// sao registradas no stdout para triagem sem bloquear o pipeline.
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

/**
 * Roda o axe e falha se houver violação serious/critical. Violações leves vão
 * para o stdout, para triagem sem bloquear.
 *
 * setLegacyMode: o contexto do Electron nao suporta criar a pagina auxiliar que
 * o AxeBuilder usa por padrao; o modo legacy roda o axe direto na pagina alvo
 * (sem iframes no app, nada se perde).
 */
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
      `[a11y] ${contexto}: ${leves.length} violação(ões) leve(s):`,
      leves.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`).join(', ')
    )
  }

  expect(
    graves.map((v) => ({
      id: v.id,
      impact: v.impact,
      descricao: v.description,
      alvos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      // O HTML do nó economiza uma rodada de investigação: o seletor gerado
      // usa hashes de CSS Module e sozinho não diz qual elemento é.
      html: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 200))
    })),
    `violações graves em ${contexto}`
  ).toEqual([])
}

test.describe('Acessibilidade (axe-core)', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina.link}: sem violações serious ou critical`, async ({ app }) => {
      const page = await app.firstWindow()
      await page.waitForLoadState('domcontentloaded')

      await page.getByRole('link', { name: pagina.link }).click()
      await expect(page.getByRole('heading', { name: pagina.heading, exact: true })).toBeVisible()

      await varrer(page, `${pagina.link} (base vazia)`)
    })
  }
})

/**
 * A varredura acima roda com a base VAZIA — foi assim que o `ConfirmDialog` sem
 * focus trap e os `<th onClick>` sem teclado passaram batido por tanto tempo.
 * Tabela, gráfico, badge de status e barra de orçamento só existem com dados,
 * e modal nenhum abre sozinho.
 */
test.describe('Acessibilidade (axe-core) — com dados', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina.link}: sem violações serious ou critical`, async ({ app }) => {
      const { page } = await semear(app)

      await page.getByRole('link', { name: pagina.link }).click()
      await expect(page.getByRole('heading', { name: pagina.heading, exact: true })).toBeVisible()

      await varrer(page, `${pagina.link} (com dados)`)
    })
  }
})

test.describe('Acessibilidade (axe-core) — modais abertos', () => {
  test('ConfirmDialog de exclusão', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Mercado da semana' })
    await acionarNoMenuDaLinha(page, linha, 'Excluir')
    await expect(page.getByRole('dialog')).toBeVisible()

    await varrer(page, 'ConfirmDialog')
  })

  test('modal de nota e tags', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Mercado da semana' })
    await acionarNoMenuDaLinha(page, linha, 'Nota/Tags')
    await expect(page.getByRole('dialog', { name: 'Nota e tags' })).toBeVisible()

    await varrer(page, 'NotaETagsModal')
  })

  test('modal de edição de despesa', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Mercado da semana' })
    await linha.getByRole('button', { name: 'Editar', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Editar despesa' })).toBeVisible()

    await varrer(page, 'EditarDespesaModal')
  })

  test('modal de marcar recebido', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Rendas' }).click()

    await page.getByRole('button', { name: 'Marcar recebido' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Marcar recebimento' })).toBeVisible()

    await varrer(page, 'MarcarRecebidoModal')
  })

  test('menu de ações da linha aberto', async ({ app }) => {
    const { page } = await semear(app)
    await page.getByRole('link', { name: 'Saídas' }).click()

    const linha = page.getByRole('row').filter({ hasText: 'Mercado da semana' })
    await linha.getByRole('button', { name: /^Mais ações/ }).click()
    await expect(page.getByRole('menu')).toBeVisible()

    await varrer(page, 'RowActions (menu aberto)')
  })
})
