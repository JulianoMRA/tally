import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures/electron-app'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ENTRADA = join(AQUI, '..', 'out', 'main', 'index.cjs')

/**
 * O tema ponta a ponta: trocar pelo menu, gravar, e reabrir no que foi gravado.
 *
 * A parte que só o E2E alcança é a última. O teste de unidade cobre o rótulo do
 * menu e o carimbo do atributo; o de `settings.ts` cobre a leitura do arquivo.
 * Nenhum dos dois prova que o app REABRE no tema certo — isso depende do
 * preload ler o settings de forma síncrona antes de a página pintar, e preload
 * não existe fora do Electron de pé.
 *
 * Foi exatamente aí que estava o defeito mais sério do trabalho: com
 * `sandbox: true`, `document.documentElement` é null quando o preload roda, e o
 * `setAttribute` derrubava o módulo inteiro — levando junto o
 * `exposeInMainWorld`, de modo que `window.api` sumia e o app não abria. Todos
 * os testes de unidade passavam, porque todos mockam `window.api`.
 */

const FUNDO_ESCURO = 'rgb(23, 20, 14)'
const FUNDO_CLARO = 'rgb(241, 235, 221)'

async function abrirMenuDoApp(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu do aplicativo' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
}

async function abrir(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return page
}

test.describe('Tema', () => {
  test('o app abre no claro por padrão', async ({ app }) => {
    const page = await abrir(app)

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'claro')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      FUNDO_CLARO
    )
  })

  // O rótulo nomeia o destino, não o estado: um item escrito "Tema claro"
  // enquanto o app está claro não diz o que o clique faz.
  test('alterna pelo menu e o rótulo passa a apontar de volta', async ({ app }) => {
    const page = await abrir(app)

    await abrirMenuDoApp(page)
    await page.getByRole('menuitem', { name: 'Tema escuro' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'escuro')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      FUNDO_ESCURO
    )

    await abrirMenuDoApp(page)
    await expect(page.getByRole('menuitem', { name: 'Tema claro' })).toBeVisible()
  })

  // A troca não pode recarregar a janela: formulário em edição se perderia.
  test('a troca não recarrega a janela nem descarta o que está digitado', async ({ app }) => {
    const page = await abrir(app)

    await page.getByRole('link', { name: 'Categorias' }).click()
    const nome = page.getByLabel('Nome', { exact: true })
    await nome.fill('Rascunho que não pode sumir')

    await abrirMenuDoApp(page)
    await page.getByRole('menuitem', { name: 'Tema escuro' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'escuro')
    await expect(nome).toHaveValue('Rascunho que não pode sumir')
  })

  /**
   * O caso que só existe aqui: grava, fecha, reabre.
   *
   * Sobe uma segunda instância apontando para o MESMO userData, em vez de usar
   * a fixture: ela cria um diretório novo por teste, e a persistência só se
   * observa reaproveitando o diretório da primeira.
   */
  test('reabre no tema escolhido, sem passar pelo claro', async ({ app, userDataDir }) => {
    const page = await abrir(app)

    await abrirMenuDoApp(page)
    await page.getByRole('menuitem', { name: 'Tema escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'escuro')

    // Espera o arquivo existir antes de fechar: a gravação é assíncrona e o
    // clique não a aguarda de propósito (o tema não pode ter latência de I/O).
    await expect
      .poll(() => {
        try {
          return JSON.parse(readFileSync(join(userDataDir, 'settings.json'), 'utf8')).tema
        } catch {
          return undefined
        }
      })
      .toBe('escuro')

    await app.close()

    const reaberto = await electron.launch({
      args: [ENTRADA],
      env: { ...process.env, TALLY_USER_DATA: userDataDir },
      timeout: 60_000
    })
    try {
      const pagina2 = await reaberto.firstWindow()
      await pagina2.waitForLoadState('domcontentloaded')

      // `toHaveAttribute` sem espera: o preload carimba antes do primeiro
      // paint, então o atributo já tem de estar lá no domcontentloaded. Um
      // valor que só aparecesse depois seria o flash que este desenho evita.
      expect(await pagina2.evaluate(() => document.documentElement.dataset.theme)).toBe('escuro')
      expect(await pagina2.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
        FUNDO_ESCURO
      )

      // A ponte precisa ter sobrevivido ao carimbo. Quando o preload lançava,
      // `window.api` sumia e o app não abria — e nenhum teste de unidade via.
      expect(
        await pagina2.evaluate(() => typeof (window as unknown as { api?: unknown }).api)
      ).toBe('object')
    } finally {
      await reaberto.close()
    }
  })
})
