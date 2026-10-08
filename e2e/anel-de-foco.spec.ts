import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import {
  ligarAltoContraste,
  faixaEmVolta,
  varrerFoco,
  type ResultadoDaVarredura
} from './fixtures/anel-de-foco'
import { abrirAba, focarCartao, irPara, type Rota } from './fixtures/navegacao'
import { semear } from './fixtures/seed'

/**
 * Gate do anel de foco: tudo que recebe foco pelo Tab mostra o anel do design
 * system inteiro e sem mudar de forma, inclusive no alto contraste do Windows.
 *
 * Os casos de `foco-teclado.spec.ts` olham dois elementos de Faturas, os que
 * apagavam o anel. Este varre as telas: o mesmo defeito podia estar em qualquer
 * lugar, e nenhuma outra tela tinha sido conferida.
 */

/**
 * Os três tipos de problema saem juntos. Com `expect` comum, o primeiro que
 * falhasse esconderia os outros, e a falha não diria tudo o que a tela tem.
 */
function conferir({ focados, problemas }: ResultadoDaVarredura, onde: string): void {
  expect(focados, `${onde}: a varredura não encontrou nada focável`).not.toHaveLength(0)
  expect.soft(problemas.semAnel, `${onde}: focados sem o anel do design system`).toEqual([])
  expect.soft(problemas.cortados, `${onde}: anel cortado`).toEqual([])
  expect.soft(problemas.mudamDeForma, `${onde}: a forma muda com o foco`).toEqual([])
}

/** A varredura não pode passar por uma lista que ainda não chegou. */
async function esperarCarga(page: Page): Promise<void> {
  await expect(page.getByText('Carregando…')).toHaveCount(0)
}

type Tela = { nome: string; rota: Rota; preparar?: (page: Page) => Promise<void> }

const TELAS: Tela[] = [
  { nome: 'Visão mensal', rota: 'Visão mensal' },
  {
    nome: 'Visão mensal, aba Análise',
    rota: 'Visão mensal',
    preparar: (page) => abrirAba(page, 'Análise')
  },
  { nome: 'Faturas', rota: 'Faturas' },
  {
    nome: 'Faturas, com o histórico aberto',
    rota: 'Faturas',
    preparar: async (page) => {
      // A fatura de mês anterior da seed está no Nubank.
      await focarCartao(page, 'Nubank Seed')
      await page.getByRole('button', { name: /meses anteriores/ }).click()
    }
  },
  { nome: 'Saídas', rota: 'Saídas' },
  { nome: 'Busca', rota: 'Busca' },
  { nome: 'Rendas', rota: 'Rendas' },
  { nome: 'Simulação', rota: 'Simulação' },
  { nome: 'Cartões', rota: 'Cartões' },
  { nome: 'Categorias', rota: 'Categorias' },
  { nome: 'Importar dados', rota: 'Importar dados' },
  { nome: 'Ajustes', rota: 'Ajustes' }
]

test.describe('Anel de foco', () => {
  test('na moldura, o anel aparece inteiro e não muda a forma', async ({ app }) => {
    const { page } = await semear(app)
    await esperarCarga(page)
    // Sem foco nenhum, o primeiro Tab vai para o começo do documento.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    conferir(await varrerFoco(page, 'moldura'), 'moldura')
  })

  for (const tela of TELAS) {
    test(`${tela.nome}: o anel aparece inteiro e não muda a forma`, async ({ app }) => {
      const { page } = await semear(app)
      await irPara(page, tela.rota)
      await esperarCarga(page)
      await tela.preparar?.(page)
      await esperarCarga(page)
      conferir(await varrerFoco(page, 'tela'), tela.nome)
    })
  }

  /*
   * O tema de contraste do Windows não pinta `box-shadow`. Com o anel de sombra
   * e o `outline` zerado no global, quem usa o tema não via onde estava o foco.
   *
   * A prova é a imagem, e não o estilo computado: o que o modo troca é o que
   * se pinta. Mesmo princípio da folha de contato, que fotografa o foco e a
   * tela sem ele e exige que as duas difiram.
   */
  test('em alto contraste, o link focado mostra o anel', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await ligarAltoContraste(page)

    const link = page.getByRole('link', { name: 'Saídas' })
    // Antes de qualquer clique, o foco por script acende `:focus-visible`.
    await link.focus()
    const comFoco = await faixaEmVolta(page, link)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const semFoco = await faixaEmVolta(page, link)

    expect(comFoco.equals(semFoco), 'em alto contraste, o foco no link não aparece').toBe(false)
  })

  // O campo fica fora do anel por decisão: borda da marca e halo, que o modo
  // também apaga. Quem aparece no lugar deles é o outline transparente.
  test('em alto contraste, o campo focado mostra o anel', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await irPara(page, 'Busca')
    await ligarAltoContraste(page)

    const campo = page.getByLabel('Descrição contém')
    await campo.focus()
    const comFoco = await faixaEmVolta(page, campo)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const semFoco = await faixaEmVolta(page, campo)

    expect(comFoco.equals(semFoco), 'em alto contraste, o foco no campo não aparece').toBe(false)
  })
})
