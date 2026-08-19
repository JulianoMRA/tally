import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'

/**
 * Trava o defeito de alinhamento horizontal entre telas.
 *
 * O `PageContainer` limitava a largura por tier (narrow 760, default 1200, wide
 * 1760) e centralizava com `margin: 0 auto`. Quando a área disponível superava o
 * `max-width` da tela, a sobra virava margem esquerda — e como cada tela tem um
 * tier diferente, o título começava num x diferente em cada rota. Numa janela
 * maximizada de 1534px de viewport a Visão mensal (wide) abria em 32px e Rendas
 * (default) em 95px; Ajustes e Importar (narrow) em 315px.
 *
 * A F8 colapsou os três tiers numa largura só, o que torna o desalinhamento
 * impossível por construção. O spec **continua valendo**: ele é o que denuncia
 * a reintrodução de largura por página, que é a forma como o defeito voltaria.
 */

const ROTAS = [
  'Visão mensal',
  'Faturas',
  'Saídas',
  'Rendas',
  'Cartões',
  'Categorias',
  'Importar dados',
  'Ajustes'
] as const

async function redimensionar(app: ElectronApplication, largura: number, altura = 800) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      BrowserWindow.getAllWindows()[0]?.setSize(w, h)
    },
    [largura, altura] as const
  )
}

async function prepararJanela(app: ElectronApplication, largura: number): Promise<Page> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await redimensionar(app, largura)
  await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)
  return page
}

/**
 * Navega até a rota e devolve o x do título e o x do bloco de página. O título é
 * a medida que o usuário enxerga; o `[data-page]` é o invariante estrutural.
 */
async function bordas(page: Page, rota: string): Promise<{ titulo: number; bloco: number }> {
  await page.getByRole('link', { name: rota }).click()

  // h1 é único por página (só existe um PageHead), então serve de âncora estável
  // sem depender do texto de cada rota.
  const titulo = page.getByRole('heading', { level: 1 })
  await expect(titulo).toHaveText(rota)

  const caixaTitulo = await titulo.boundingBox()
  const caixaBloco = await page.locator('[data-page]').first().boundingBox()
  expect(caixaTitulo, `título de ${rota} sem caixa`).not.toBeNull()
  expect(caixaBloco, `bloco de página de ${rota} não encontrado`).not.toBeNull()

  return { titulo: caixaTitulo!.x, bloco: caixaBloco!.x }
}

function amplitude(valores: number[]): number {
  return Math.max(...valores) - Math.min(...valores)
}

test.describe('Alinhamento horizontal entre páginas', () => {
  for (const largura of [1024, 1280, 1760] as const) {
    test(`todas as páginas abrem na mesma borda esquerda em ${largura}px`, async ({ app }) => {
      const page = await prepararJanela(app, largura)

      const medidas: Record<string, { titulo: number; bloco: number }> = {}
      for (const rota of ROTAS) {
        medidas[rota] = await bordas(page, rota)
      }

      const contexto = JSON.stringify(medidas)
      const titulos = Object.values(medidas).map((m) => m.titulo)
      const blocos = Object.values(medidas).map((m) => m.bloco)

      expect(amplitude(titulos), `títulos desalinhados: ${contexto}`).toBeLessThanOrEqual(1)
      expect(amplitude(blocos), `blocos desalinhados: ${contexto}`).toBeLessThanOrEqual(1)
    })
  }

  /**
   * O caso em que a página realmente centraliza só acontece quando a área
   * disponível supera `--page-max` — precisaria de ~1770px de viewport, mais do
   * que a janela do runner alcança. Encolher o token exercita o mesmo ramo de
   * layout de forma determinística, e continua provando o que interessa: quando
   * a centralização entra, todas as rotas deslocam **juntas**.
   */
  test('páginas deslocam juntas quando a largura centraliza', async ({ app }) => {
    const page = await prepararJanela(app, 1280)
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--page-max', '600px')
    })

    const medidas: Record<string, number> = {}
    for (const rota of ROTAS) {
      medidas[rota] = (await bordas(page, rota)).bloco
    }

    const valores = Object.values(medidas)
    expect(
      amplitude(valores),
      `blocos desalinhados: ${JSON.stringify(medidas)}`
    ).toBeLessThanOrEqual(1)
    // E de fato centralizou: com 600px numa área de ~1058px, a sobra empurra a
    // página bem para além do padding de 32px.
    expect(valores[0]).toBeGreaterThan(100)
  })
})
