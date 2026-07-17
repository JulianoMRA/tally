import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures/electron-app'

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

test.describe('Acessibilidade (axe-core)', () => {
  for (const pagina of PAGINAS) {
    test(`${pagina.link}: sem violações serious ou critical`, async ({ app }) => {
      const page = await app.firstWindow()
      await page.waitForLoadState('domcontentloaded')

      await page.getByRole('link', { name: pagina.link }).click()
      await expect(page.getByRole('heading', { name: pagina.heading, exact: true })).toBeVisible()

      // setLegacyMode: o contexto do Electron nao suporta criar a pagina
      // auxiliar que o AxeBuilder usa por padrao; o modo legacy roda o axe
      // direto na pagina alvo (sem iframes no app, nada se perde).
      const resultado = await new AxeBuilder({ page }).setLegacyMode(true).analyze()

      const graves = resultado.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      )
      const leves = resultado.violations.filter(
        (v) => v.impact !== 'serious' && v.impact !== 'critical'
      )
      if (leves.length > 0) {
        console.log(
          `[a11y] ${pagina.link}: ${leves.length} violação(ões) leve(s):`,
          leves.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`).join(', ')
        )
      }

      expect(
        graves.map((v) => ({
          id: v.id,
          impact: v.impact,
          descricao: v.description,
          alvos: v.nodes.slice(0, 3).map((n) => n.target.join(' '))
        }))
      ).toEqual([])
    })
  }
})
