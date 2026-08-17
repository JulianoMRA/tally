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

  // O refactor visual moveu os gráficos para a aba Análise: a aba Mês passou a
  // ser só operação. A promessa de "sem rolar" migrou junto — quem responde a
  // pergunta da tela agora é o hero de saldo com a agenda ao lado, e são esses
  // dois que precisam caber na primeira tela da janela padrão.
  test('Visão mensal responde na primeira tela da janela padrão (1280px)', async ({ app }) => {
    // Com dados: na base vazia o painel de primeiro uso ocupa o topo, o que é o
    // comportamento certo — quem não tem nada cadastrado não precisa disso.
    await semear(app)
    const page = await abrir(app, 1280, 'Visão mensal')

    await expect(page.getByText('Sobra projetada do mês')).toBeInViewport()
    await expect(page.getByRole('heading', { name: 'Ainda vai acontecer' })).toBeInViewport()
  })

  test('gráficos continuam acessíveis na aba Análise', async ({ app }) => {
    await semear(app)
    const page = await abrir(app, 1280, 'Visão mensal')

    await page.getByRole('tab', { name: 'Análise', exact: true }).click()
    // O painel de gráficos é lazy: espera o chunk chegar.
    await expect(page.getByRole('heading', { name: 'Evolução do saldo' })).toBeVisible()
  })

  test('Visão mensal usa duas colunas a partir de 1180px e uma abaixo disso', async ({ app }) => {
    await semear(app)
    const larga = await abrir(app, 1280, 'Visão mensal')
    await expect(larga.getByRole('heading', { name: 'Ainda vai acontecer' })).toBeVisible()

    // `.layout` virou wrapper flex; quem carrega o grid são as duas faixas.
    const colunas = async (page: Page) =>
      page.evaluate(() => {
        const grade = document.querySelector('[class*="gradeTopo"]')
        if (!grade) return null
        const cs = getComputedStyle(grade)
        return cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').length : 1
      })

    expect(await colunas(larga)).toBe(2)

    await redimensionar(app, 1100)
    await expect.poll(async () => larga.evaluate(() => window.innerWidth)).toBeLessThan(1101)
    expect(await colunas(larga)).toBe(1)
  })

  // O breakpoint de 1400px existia só para decidir se o formulário cabia ao
  // lado da tabela. Com o cadastro no `SidePanel` (ponto 08), a pergunta some:
  // a tabela recebe a largura inteira em qualquer janela, e é isso que estes
  // dois testes passam a travar.
  for (const largura of [1280, 1440] as const) {
    test(`Saídas dá a largura inteira à tabela em ${largura}px`, async ({ app }) => {
      await semear(app)
      const page = await abrir(app, largura, 'Saídas')

      const conteudo = await caixa(page, '[data-width]')
      const tabela = await caixa(page, 'table')
      expect(conteudo, 'bloco de conteúdo não encontrado').not.toBeNull()
      expect(tabela, 'tabela de lançamentos não encontrada').not.toBeNull()

      // Folga sobre os ~698px que a tabela precisa para não cortar colunas.
      expect(tabela!.width).toBeGreaterThan(698)

      // Nenhuma coluna de formulário disputa espaço. A margem de 80px absorve
      // o padding do PageContainer (32px de cada lado) e ainda reprova de longe
      // se voltar uma coluna de 400px ao lado.
      expect(tabela!.width).toBeGreaterThan(conteudo!.width - 80)
    })
  }

  test('o cadastro de Saídas abre como painel sobreposto, não como coluna', async ({ app }) => {
    const page = await abrir(app, 1280, 'Saídas')

    // Fechado, o formulário não ocupa espaço nenhum no layout.
    await expect(page.getByLabel('Descrição')).toHaveCount(0)

    await page.getByRole('button', { name: '+ Nova saída' }).click()
    const painel = page.getByRole('dialog', { name: 'Nova saída' })
    await expect(painel).toBeVisible()

    // Sobreposto: o painel encosta na borda direita da janela, em vez de
    // dividir a linha com a lista.
    const caixaPainel = await painel.boundingBox()
    const larguraViewport = await page.evaluate(() => window.innerWidth)
    expect(caixaPainel).not.toBeNull()
    expect(caixaPainel!.x + caixaPainel!.width).toBeGreaterThanOrEqual(larguraViewport - 1)
  })
})
