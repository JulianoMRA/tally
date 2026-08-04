import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Abre o menu "⋯" de uma linha e aciona a ação pelo rótulo.
 *
 * Desde a fase 3 do plano de UI/UX, só a ação primária fica visível na linha;
 * o resto vive num menu renderizado num portal em `document.body` — por isso o
 * `menuitem` é procurado a partir da `page`, e não da `linha`.
 */
export async function acionarNoMenuDaLinha(
  page: Page,
  linha: Locator,
  acao: string
): Promise<void> {
  await linha.getByRole('button', { name: /^Mais ações/ }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: acao, exact: true }).click()
}
