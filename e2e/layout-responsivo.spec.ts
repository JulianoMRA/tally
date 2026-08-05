import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { semear } from './fixtures/seed'

/**
 * Fase 4 do plano de UI/UX. Três defeitos que este spec trava:
 *
 * 1. A Visão mensal só virava duas colunas em 1440px, acima da janela padrão do
 *    app (1280) — quem não maximizava via os gráficos empilhados depois de toda
 *    a coluna operacional, a mais de uma tela de scroll.
 * 2. Saídas só virava duas colunas em 1940px, largura que praticamente ninguém
 *    usa, deixando ~600px mortos ao lado de um formulário de 560px.
 * 3. Com colunas fixas, a de gráficos era muito mais alta que a operacional e
 *    sobrava um vazio enorme embaixo da esquerda.
 */

async function redimensionar(app: ElectronApplication, largura: number, altura = 800) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      BrowserWindow.getAllWindows()[0]?.setSize(w, h)
    },
    [largura, altura] as const
  )
}

async function abrir(app: ElectronApplication, largura: number, rota: string): Promise<Page> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await redimensionar(app, largura)
  await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)
  await page.getByRole('link', { name: rota }).click()
  await expect(page.getByRole('heading', { name: rota, exact: true })).toBeVisible()
  return page
}

async function temScrollHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement
    return el.scrollWidth > el.clientWidth + 1
  })
}

/** Caixa de um elemento pelo seletor, ou null se ele não existir. */
async function caixa(page: Page, seletor: string) {
  return page.locator(seletor).first().boundingBox()
}

test.describe('Layout responsivo', () => {
  for (const largura of [1024, 1280, 1760] as const) {
    test(`nenhuma página gera scroll horizontal em ${largura}px`, async ({ app }) => {
      for (const rota of ['Visão mensal', 'Saídas', 'Faturas', 'Rendas', 'Cartões', 'Ajustes']) {
        const page = await abrir(app, largura, rota)
        expect(await temScrollHorizontal(page), `${rota} rolou na horizontal`).toBe(false)
      }
    })
  }

  test('Visão mensal mostra os gráficos sem rolar na janela padrão (1280px)', async ({ app }) => {
    // Com dados: na base vazia o painel de primeiro uso ocupa o topo, o que é o
    // comportamento certo — quem não tem nada cadastrado não precisa de gráfico.
    await semear(app)
    const page = await abrir(app, 1280, 'Visão mensal')

    // O painel de gráficos é lazy: espera o chunk chegar.
    const evolucao = page.getByRole('heading', { name: 'Evolução do saldo' })
    await expect(evolucao).toBeVisible()

    // Sem rolar: o painel precisa estar dentro da primeira tela.
    await expect(evolucao).toBeInViewport()
  })

  test('Visão mensal usa duas colunas a partir de 1180px e uma abaixo disso', async ({ app }) => {
    const larga = await abrir(app, 1280, 'Visão mensal')
    await expect(larga.getByRole('heading', { name: 'Evolução do saldo' })).toBeVisible()

    const colunas = async (page: Page) =>
      page.evaluate(() => {
        const layout = document.querySelector('[class*="layout"]')
        if (!layout) return null
        const cs = getComputedStyle(layout)
        return cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').length : 1
      })

    expect(await colunas(larga)).toBe(2)

    await redimensionar(app, 1100)
    await expect.poll(async () => larga.evaluate(() => window.innerWidth)).toBeLessThan(1101)
    expect(await colunas(larga)).toBe(1)
  })

  test('Saídas põe formulário e lista lado a lado em 1440px', async ({ app }) => {
    const page = await abrir(app, 1440, 'Saídas')

    const form = await caixa(page, '[class*="colCadastro"]')
    const lista = await caixa(page, '[class*="colLista"]')
    expect(form, 'coluna de cadastro não encontrada').not.toBeNull()
    expect(lista, 'coluna da lista não encontrada').not.toBeNull()

    // Lado a lado: o formulário termina antes de a lista começar.
    expect(form!.x + form!.width).toBeLessThanOrEqual(lista!.x + 1)
    // E a lista fica com a maior parte do espaço, que é o ponto da mudança:
    // antes, esta largura ficava empilhada e sobravam ~600px mortos ao lado
    // de um formulário de 560px.
    expect(lista!.width).toBeGreaterThan(form!.width)
  })

  // Guarda a razão do breakpoint ser 1400 e não 1280: a janela padrão do app
  // entrega 1266px de viewport (o `width: 1280` do BrowserWindow é o tamanho
  // EXTERNO), e nessa largura a coluna da lista ficaria com 606px contra os
  // ~698px que a tabela precisa. Empilhado ela recebe a largura inteira.
  test('Saídas empilha na janela padrão, onde a tabela precisa da largura inteira', async ({
    app
  }) => {
    const page = await abrir(app, 1280, 'Saídas')

    const form = await caixa(page, '[class*="colCadastro"]')
    const lista = await caixa(page, '[class*="colLista"]')
    expect(form).not.toBeNull()
    expect(lista).not.toBeNull()

    // Empilhado: a lista começa depois de o formulário terminar.
    expect(lista!.y).toBeGreaterThanOrEqual(form!.y + form!.height - 1)
  })
})
