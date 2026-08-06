import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures/electron-app'

/**
 * Trava a observabilidade do updater.
 *
 * Quando o repositório ficou privado, a checagem de atualização passou a receber
 * 404 e o app instalado parou de atualizar em silêncio: o catch do boot só fazia
 * `console.error`, e binário empacotado não tem console. A falha só apareceu
 * comparando o cache do updater na mão, dias depois.
 *
 * O log em arquivo é o que fecha essa lacuna. O caminho precisa sair de
 * `userData`, senão o E2E escreveria no log do app real — por isso o spec assere
 * contra o diretório isolado da fixture, o que também prova o isolamento.
 */

function caminhoDoLog(userDataDir: string): string {
  return join(userDataDir, 'logs', 'main.log')
}

test.describe('Log do main process', () => {
  test('grava em arquivo dentro do userData isolado', async ({ app, userDataDir }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    const log = caminhoDoLog(userDataDir)
    await expect.poll(() => existsSync(log), { message: `log não apareceu em ${log}` }).toBe(true)

    // O boot registra o estado que decide se a checagem roda. Sem essa linha,
    // um app que nunca chega a checar fica indistinguível de um que checou e
    // falhou — que foi exatamente a ambiguidade que custou o diagnóstico.
    await expect.poll(() => readFileSync(log, 'utf8')).toContain('[updater] versão')
  })

  test('registra que a checagem não roda fora de um app empacotado', async ({
    app,
    userDataDir
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    const log = caminhoDoLog(userDataDir)
    await expect.poll(() => existsSync(log)).toBe(true)

    // `checkForUpdatesAndNotify` só roda com app.isPackaged — em E2E o app vem
    // do diretório de build, então o log tem que dizer isso explicitamente.
    await expect.poll(() => readFileSync(log, 'utf8')).toContain('empacotado=false')
  })
})
