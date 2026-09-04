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
  | 'Simulação'
  | 'Cartões'
  | 'Categorias'
  | 'Importar dados'
  | 'Ajustes'

export async function irPara(page: Page, rota: Rota): Promise<void> {
  await page.getByRole('link', { name: rota }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(rota)
}

/**
 * Abre o painel de cadastro de Saídas e espera o formulário estar pronto.
 *
 * O formulário deixou de ser fixo na tela e virou `SidePanel` sob demanda
 * (ponto 08 do diagnóstico), então preencher um campo agora exige abrir o
 * painel antes. Esperar o diálogo evita a mesma corrida do `irPara`: entre o
 * clique e a montagem, `getByLabel('Descrição')` resolveria contra a página.
 */
export async function abrirCadastroDeSaida(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ Nova saída' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova saída' })).toBeVisible()
}

/**
 * Põe um cartão em foco no trilho de Faturas.
 *
 * O `select` de cartão foi absorvido pelo trilho na fusão de lista e detalhe
 * (ponto 12). Escolher o cartão já abre a fatura corrente dele — não há mais um
 * segundo clique numa lista. Espera o painel refletir a troca antes de devolver.
 */
export async function focarCartao(page: Page, nome: string): Promise<void> {
  const item = page.getByRole('button', { name: new RegExp(`^${nome}`) })
  await item.click()
  await expect(item).toHaveAttribute('aria-pressed', 'true')
}

/**
 * Abre uma fatura passada específica pelo histórico do cartão em foco.
 *
 * Faturas futuras não estão no histórico — são alcançadas pela navegação de mês
 * do painel. Use esta função só para meses já encerrados.
 */
export async function abrirFaturaNoHistorico(page: Page, mesPorExtenso: string): Promise<void> {
  await page.getByRole('button', { name: /meses anteriores/ }).click()
  await page.getByText(mesPorExtenso, { exact: true }).click()
}

/** Abas da Visão mensal (RF-VIS-02): operação em "Mês", histórico em "Análise". */
export type AbaVisaoMensal = 'Mês' | 'Análise'

/**
 * Troca de aba dentro da Visão mensal, esperando o `aria-selected` virar.
 *
 * Sem o guard, o clique e a asserção seguinte correm entre si igual ao caso do
 * `irPara`: os painéis da aba anterior continuam montados por um frame, e um
 * locator por heading resolve contra eles.
 */
export async function abrirAba(page: Page, aba: AbaVisaoMensal): Promise<void> {
  const tab = page.getByRole('tab', { name: aba, exact: true })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

/**
 * Cria um cartão do zero, navegando até a tela.
 *
 * O formulário de Cartões virou `SidePanel` sob demanda (ponto 16), o mesmo
 * movimento que Saídas fez na F3. Dezenove specs abriam com este mesmo
 * preâmbulo de seis linhas só para ter um cartão em base; concentrá-lo aqui é o
 * que evita que a próxima mudança de layout quebre todas elas de novo.
 *
 * Os campos são procurados dentro do diálogo: `Nome` é rótulo repetido entre
 * Cartões e Categorias, e a página por baixo continua montada.
 */
export async function criarCartao(
  page: Page,
  nome: string,
  diaFechamento = '5',
  diaVencimento = '12'
): Promise<void> {
  await irPara(page, 'Cartões')
  await page.getByRole('button', { name: '+ Novo cartão' }).click()

  const painel = page.getByRole('dialog', { name: 'Novo cartão' })
  await expect(painel).toBeVisible()
  await painel.getByLabel('Nome').fill(nome)
  await painel.getByLabel('Dia de fechamento').fill(diaFechamento)
  await painel.getByLabel('Dia de vencimento').fill(diaVencimento)
  await painel.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText(nome)).toBeVisible()
}

/** Mesma história de `criarCartao`, para Categorias. */
export async function criarCategoria(
  page: Page,
  nome: string,
  tipo: 'Despesa' | 'Renda' = 'Despesa'
): Promise<void> {
  await irPara(page, 'Categorias')
  await page.getByRole('button', { name: '+ Nova categoria' }).click()

  const painel = page.getByRole('dialog', { name: 'Nova categoria' })
  await expect(painel).toBeVisible()
  await painel.getByLabel('Nome').fill(nome)
  await painel.getByRole('radio', { name: tipo }).check()
  await painel.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText(nome)).toBeVisible()
}
