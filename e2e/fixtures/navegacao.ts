import { expect, type Page } from '@playwright/test'

/**
 * Navegação entre rotas com guard de chegada.
 *
 * Clicar no link e interagir com o formulário na linha seguinte é uma corrida:
 * entre o clique e o re-render do React a página ANTERIOR ainda está montada, e
 * um locator por rótulo resolve contra ela. Como vários rótulos se repetem entre
 * telas, o `fill` cai no formulário errado, o submit falha na validação e o teste
 * estoura num `toBeVisible` lá adiante — longe da causa.
 *
 * Reproduzido com `Emulation.setCPUThrottlingRate: 20`: depois de clicar em
 * "Categorias", `getByLabel('Nome').fill(...)` escreveu no campo Nome de
 * **Cartões**. Sob 4 workers a janela abre sozinha, o que explica a flakiness
 * intermitente de `saidas-acoes-visiveis.spec.ts` — a maioria dos specs já
 * esperava o heading na mão, e os que esqueceram eram justamente os afetados.
 *
 * Pares de rótulo repetido conhecidos hoje: `Nome` (Cartões e Categorias),
 * `Cartão` e `Mês` (Saídas, Faturas, Visão mensal e Rendas).
 *
 * O h1 de cada página tem exatamente o mesmo texto do link na sidebar, então ele
 * serve de guard sem parâmetro extra.
 */

export type Rota =
  | 'Visão mensal'
  | 'Faturas'
  | 'Saídas'
  | 'Rendas'
  | 'Cartões'
  | 'Categorias'
  | 'Importar dados'
  | 'Ajustes'

export async function irPara(page: Page, rota: Rota): Promise<void> {
  await page.getByRole('link', { name: rota }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(rota)
}
