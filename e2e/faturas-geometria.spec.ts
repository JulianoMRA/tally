import { test, expect } from './fixtures/electron-app'
import {
  abrirCadastroDeSaida,
  criarCartao,
  criarCategoria,
  focarCartao,
  irPara
} from './fixtures/navegacao'
import type { ElectronApplication, Locator, Page } from '@playwright/test'

/**
 * Uma borda direita só na tela de Faturas (R14 do plano de Faturas).
 *
 * O detalhe tinha teto de 880px empilhado e 1280px lado a lado, enquanto a
 * navegação de mês e o histórico ocupavam a largura toda: na janela maximizada
 * a tabela terminava em x≈1590 e "outubro de 2026 →" em x≈1797. O jsdom não faz
 * layout, então o aceite é geométrico: a faixa de resumo, o painel de parcelas
 * e o histórico terminam na mesma borda, com tolerância de 1px.
 */

async function redimensionar(app: ElectronApplication, largura: number) {
  await app.evaluate(({ BrowserWindow }, w) => {
    BrowserWindow.getAllWindows()[0]?.setSize(w, 900)
  }, largura)
}

async function lancar(page: Page, descricao: string, dataCompra: string, valor = '75,00') {
  await irPara(page, 'Saídas')
  await abrirCadastroDeSaida(page)
  await page.getByLabel('Descrição').fill(descricao)
  await page.getByLabel(/^Categoria/).selectOption({ label: 'Mercado Borda E2E' })
  await page.getByLabel('Cartão').selectOption({ label: 'Inter Borda E2E' })
  await page.getByLabel('Valor (R$)').fill(valor)
  await page.getByLabel('Data da compra').fill(dataCompra)
  await page.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova saída' })).toHaveCount(0)
}

/** Painel = `div.panel > div.head > h3`: o título sobe dois níveis até a caixa. */
function painel(page: Page, titulo: string): Locator {
  return page.getByRole('heading', { name: titulo, exact: true }).locator('../..')
}

async function bordaDireita(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('elemento sem caixa')
  return caixa.x + caixa.width
}

async function altura(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('elemento sem caixa')
  return caixa.height
}

for (const largura of [1024, 1280, 1760] as const) {
  test(`faixa, lançamentos e histórico terminam na mesma borda em ${largura}px`, async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Borda E2E')
    await criarCategoria(page, 'Mercado Borda E2E')
    // Junho vai para o histórico; a compra do mês que vem abre o painel.
    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const proxima = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
    await lancar(page, 'Compra antiga', '2026-06-03')
    await lancar(page, 'Compra nova', proxima)

    await redimensionar(app, largura)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Borda E2E')

    const faixa = page.getByRole('region', { name: 'Resumo da fatura' })
    const lancamentos = painel(page, 'Lançamentos')
    const historico = painel(page, 'Histórico deste cartão')
    await expect(faixa).toBeVisible()
    await expect(historico).toBeVisible()

    const referencia = await bordaDireita(lancamentos)
    expect(Math.abs((await bordaDireita(faixa)) - referencia)).toBeLessThanOrEqual(1)
    expect(Math.abs((await bordaDireita(historico)) - referencia)).toBeLessThanOrEqual(1)

    // E nada da página passa da largura da janela.
    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(rolagem, 'a página rolou na horizontal').toBeLessThanOrEqual(0)
  })

  /**
   * Com pagamento parcial (RF-FAT-07) a faixa ganha dois valores e um botão, e
   * entra um painel entre ela e os lançamentos. É a faixa mais cheia que a tela
   * monta, e o que ela precisa provar é que o conteúdo cabe DENTRO dela.
   *
   * A borda da faixa e a rolagem da página não bastam: sem a quebra de linha no
   * bloco do fim, em 1024px a faixa segue na borda certa e a página não rola —
   * os rótulos é que se partem palavra por palavra ("TOTAL / DA / FATURA") e o
   * "Fechar fatura" sai 28px para fora do card. Medido com a regra revertida.
   * Valores de cinco dígitos, porque é com eles que falta largura.
   */
  test(`com pagamento parcial, o conteúdo da faixa cabe nela em ${largura}px`, async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await criarCartao(page, 'Inter Borda E2E')
    await criarCategoria(page, 'Mercado Borda E2E')
    const hoje = new Date()
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
    const proxima = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
    await lancar(page, 'Compra antiga', '2026-06-03')
    await lancar(page, 'Compra nova', proxima, '12.345,67')

    await redimensionar(app, largura)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(largura + 1)

    await irPara(page, 'Faturas')
    await focarCartao(page, 'Inter Borda E2E')

    await page.getByRole('button', { name: 'Pagamento parcial' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Registrar pagamento parcial' })
    await dialogo.getByLabel('Valor (R$)').fill('2.345,67')
    await dialogo.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(dialogo).toHaveCount(0)

    const faixa = page.getByRole('region', { name: 'Resumo da fatura' })
    const pagamentos = page.getByRole('region', { name: 'Pagamentos parciais' })
    const lancamentos = painel(page, 'Lançamentos')
    const historico = painel(page, 'Histórico deste cartão')
    await expect(faixa).toContainText(/Falta pagar\s*R\$\s*10\.000,00/)
    await expect(pagamentos).toBeVisible()

    const referencia = await bordaDireita(lancamentos)
    const bordaDaFaixa = await bordaDireita(faixa)
    expect(Math.abs(bordaDaFaixa - referencia)).toBeLessThanOrEqual(1)
    expect(Math.abs((await bordaDireita(pagamentos)) - referencia)).toBeLessThanOrEqual(1)
    expect(Math.abs((await bordaDireita(historico)) - referencia)).toBeLessThanOrEqual(1)

    for (const nome of ['Pagamento parcial', 'Fechar fatura']) {
      expect(
        await bordaDireita(faixa.getByRole('button', { name: nome })),
        `"${nome}" passou da borda da faixa`
      ).toBeLessThanOrEqual(bordaDaFaixa)
    }

    // "Fechamento" é uma palavra só e nunca quebra: é a régua de uma linha.
    const umaLinha = await altura(faixa.getByText('Fechamento', { exact: true }))
    for (const rotulo of ['Total da fatura', 'Pagamentos parciais', 'Falta pagar']) {
      expect(
        await altura(faixa.getByText(rotulo, { exact: true })),
        `o rótulo "${rotulo}" quebrou de linha`
      ).toBeLessThanOrEqual(umaLinha + 1)
    }

    const rolagem = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(rolagem, 'a página rolou na horizontal').toBeLessThanOrEqual(0)
  })
}

/**
 * Geometria do trilho de cartões (plano de acabamento de Faturas, out/2026).
 *
 * Três defeitos que só existem com layout de verdade, e que a folha de contato
 * mostrou antes de qualquer teste: o grid nunca usava o mínimo de 200px e
 * quebrava a fileira cedo; o selo "Arquivado" e a linha do pagamento parcial
 * tiravam o total e o prazo de alinhamento entre os cards; e o aviso de que o
 * painel saiu da fatura corrente acrescentava uma linha ao card, o que
 * aumentava a fileira e empurrava a página no primeiro clique numa seta.
 *
 * A semente vai pelo IPC: são cartões e estados, e não formulários.
 */

type ApiTrilho = {
  cartao: {
    create: (i: unknown) => Promise<{ id: number }>
    arquivar: (id: number) => Promise<unknown>
  }
  categoria: { create: (i: unknown) => Promise<{ id: number }> }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<{ fatura: { id: number } }>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
  }
  fatura: { registrarPagamentoParcial: (i: unknown) => Promise<unknown> }
}

async function recarregar(page: Page) {
  // Os hooks carregaram antes da semente.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
}

function trilho(page: Page): Locator {
  return page.getByRole('group', { name: 'Cartões' })
}

/** Quantos cards há em cada fileira do trilho, de cima para baixo. */
async function fileiras(cards: Locator): Promise<number[]> {
  return cards.evaluateAll((els) => {
    const porTopo = new Map<number, number>()
    for (const el of els) {
      const topo = Math.round(el.getBoundingClientRect().top)
      porTopo.set(topo, (porTopo.get(topo) ?? 0) + 1)
    }
    return [...porTopo.entries()].sort((a, b) => a[0] - b[0]).map(([, quantos]) => quantos)
  })
}

const folga = (valores: number[]) => Math.max(...valores) - Math.min(...valores)

/** A diferença entre o card mais largo e o mais estreito. */
async function folgaDeLargura(cards: Locator): Promise<number> {
  return folga(await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width)))
}

/** O topo do total e a base do prazo ficam na mesma altura em todos os cards. */
async function esperarTotalEPrazoAlinhados(cards: Locator): Promise<void> {
  const medidas = await cards.evaluateAll((els) =>
    els.map((card) => {
      const folhas = [...card.querySelectorAll('span')].filter((s) => s.children.length === 0)
      const texto = (s: Element) => (s.textContent ?? '').trim()
      const total = folhas.find((s) => /^R\$\s*[\d.]+,\d{2}$/.test(texto(s)))
      const prazo = folhas.find((s) => /^(vence|vencida há|fecha|paga em)/.test(texto(s)))
      if (!total || !prazo) throw new Error(`card sem total ou prazo: ${card.textContent}`)
      return {
        topoDoTotal: total.getBoundingClientRect().top,
        baseDoPrazo: prazo.getBoundingClientRect().bottom
      }
    })
  )
  expect(folga(medidas.map((m) => m.topoDoTotal)), 'totais desalinhados').toBeLessThanOrEqual(1)
  expect(folga(medidas.map((m) => m.baseDoPrazo)), 'prazos desalinhados').toBeLessThanOrEqual(1)
}

test.describe('Faturas — geometria do trilho', () => {
  // O grid era `repeat(auto-fit, minmax(200px, 300px))`, e o `auto-fit` conta
  // as colunas pelo máximo: cabiam quatro cards de 240px em 1280px e o quarto
  // caía para a linha de baixo; em 1024px, o terceiro.
  //
  // A largura entra no aceite porque a primeira correção, com flex, passava no
  // resto: o card que caía para a fileira de baixo crescia até o teto e ficava
  // 60px mais largo que os de cima. Foi a folha de contato que mostrou.
  test('os cards encolhem antes de quebrar, todos com a mesma largura', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      const api = (window as unknown as { api: ApiTrilho }).api
      for (const nome of ['Cartao A', 'Cartao B', 'Cartao C', 'Cartao D']) {
        await api.cartao.create({ nome, diaFechamento: 5, diaVencimento: 12, cor: '#a88454' })
      }
    })
    await recarregar(page)

    await redimensionar(app, 1280)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(1281)
    await irPara(page, 'Faturas')
    const cards = trilho(page).getByRole('button')
    await expect(cards).toHaveCount(4)
    await expect.poll(() => fileiras(cards), 'em 1280px').toEqual([4])
    expect(await folgaDeLargura(cards), 'larguras diferentes em 1280px').toBeLessThanOrEqual(1)

    await redimensionar(app, 1024)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(1025)
    await expect.poll(() => fileiras(cards), 'em 1024px').toEqual([3, 1])
    expect(await folgaDeLargura(cards), 'larguras diferentes em 1024px').toBeLessThanOrEqual(1)
  })

  // O selo "Arquivado" engrossava a linha do mês e empurrava o total só no
  // card dele; a linha de contexto do pagamento parcial descia o prazo só no
  // card que a tinha.
  test('total e prazo ficam na mesma altura em todos os cards da fileira', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      const api = (window as unknown as { api: ApiTrilho }).api
      const hoje = new Date()
      const data = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const mesQueVem = data(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3))
      const categoria = await api.categoria.create({ nome: 'Mercado Trilho E2E', cor: '#5b7a5e' })
      const cartao = (nome: string) =>
        api.cartao.create({ nome, diaFechamento: 5, diaVencimento: 12, cor: '#a88454' })
      const compra = (cartaoId: number, dataCompra: string) =>
        api.despesa.criarUnicaCredito({
          descricao: 'Compra do trilho',
          categoriaId: categoria.id,
          cartaoId,
          valorCentavos: 7500,
          dataCompra
        })

      // Com pagamento parcial: ganha a linha de contexto.
      const comParcial = await cartao('Com parcial')
      const { fatura } = await compra(comParcial.id, mesQueVem)
      await api.fatura.registrarPagamentoParcial({
        faturaId: fatura.id,
        valorCentavos: 2500,
        dataPagamento: data(hoje)
      })
      // Sem nada além do básico.
      await compra((await cartao('Simples')).id, mesQueVem)
      // Arquivado com fatura a pagar: ganha o selo na linha do mês.
      const antigo = await cartao('Velho')
      await compra(antigo.id, '2026-06-03')
      await api.cartao.arquivar(antigo.id)
    })
    await recarregar(page)
    await irPara(page, 'Faturas')

    const cards = trilho(page).getByRole('button')
    await expect(cards).toHaveCount(3)
    await expect(cards.filter({ hasText: 'pagos de' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Arquivado' })).toHaveCount(1)
    await expect.poll(() => fileiras(cards)).toEqual([3])

    await esperarTotalEPrazoAlinhados(cards)
  })

  // O aviso era uma linha a mais no pé do card: a fileira crescia uns 30px e
  // as setas saíam de baixo do cursor no primeiro clique. Agora é a linha do
  // mês que muda, e o clique no card em foco leva de volta.
  test('sair da fatura corrente não muda a altura do trilho, e o card leva de volta', async ({
    app
  }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      const api = (window as unknown as { api: ApiTrilho }).api
      const hoje = new Date()
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
      const mesQueVem = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
      const categoria = await api.categoria.create({ nome: 'Mercado Volta E2E', cor: '#5b7a5e' })
      const cartao = await api.cartao.create({
        nome: 'Inter Volta E2E',
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#a88454'
      })
      // Duas parcelas: a fatura corrente e a seguinte, para onde a seta leva.
      await api.despesa.criarParceladaCredito({
        descricao: 'Parcelada em duas',
        categoriaId: categoria.id,
        cartaoId: cartao.id,
        totalParcelas: 2,
        valorTotalCentavos: 20000,
        dataCompra: mesQueVem
      })
    })
    await recarregar(page)
    await irPara(page, 'Faturas')

    const titulo = page.getByRole('heading', { level: 2 })
    await expect(titulo).toContainText('Inter Volta E2E')
    const corrente = (await titulo.textContent()) ?? ''
    const alturaAntes = await altura(trilho(page))

    await page.getByRole('button', { name: /^Próxima fatura/ }).click()
    await expect(titulo).not.toHaveText(corrente)
    expect(
      Math.abs((await altura(trilho(page))) - alturaAntes),
      'o trilho mudou de altura'
    ).toBeLessThanOrEqual(1)

    const card = trilho(page).getByRole('button')
    await expect(card).toContainText(/voltar para/)
    await card.click()
    await expect(titulo).toHaveText(corrente)
    await expect(card).not.toContainText(/voltar para/)
  })

  // A volta e o selo "Arquivado" não cabem lado a lado: a linha do mês
  // quebrava em duas, e o total descia 24px só no card arquivado. Os casos de
  // cima não viam: num o cartão arquivado está na fatura corrente, no outro o
  // cartão que sai dela não é arquivado. Foi a folha de contato que mostrou.
  test('no cartão arquivado, a volta não tira o total nem o prazo do lugar', async ({ app }) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(async () => {
      const api = (window as unknown as { api: ApiTrilho }).api
      const hoje = new Date()
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
      const mesQueVem = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`
      const categoria = await api.categoria.create({
        nome: 'Mercado Arquivado E2E',
        cor: '#5b7a5e'
      })
      const cartao = (nome: string) =>
        api.cartao.create({ nome, diaFechamento: 5, diaVencimento: 12, cor: '#a88454' })
      const compra = (cartaoId: number, dataCompra: string) =>
        api.despesa.criarUnicaCredito({
          descricao: 'Compra do trilho',
          categoriaId: categoria.id,
          cartaoId,
          valorCentavos: 7500,
          dataCompra
        })

      // Quatro cards: em 1280px cada um fica com 240px, que é onde a volta e
      // o selo não cabem na mesma linha. Com dois, de 300px, cabiam — e o caso
      // passava também contra o código que quebrava a linha.
      for (const nome of ['Cartao A', 'Cartao B', 'Cartao C']) {
        await compra((await cartao(nome)).id, mesQueVem)
      }
      // Duas faturas no arquivado: a corrente e a anterior, para onde a seta leva.
      const antigo = await cartao('Velho')
      await compra(antigo.id, '2026-06-03')
      await compra(antigo.id, '2026-07-03')
      await api.cartao.arquivar(antigo.id)
    })
    await recarregar(page)
    await redimensionar(app, 1280)
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBeLessThan(1281)
    await irPara(page, 'Faturas')

    const cards = trilho(page).getByRole('button')
    await expect(cards).toHaveCount(4)
    await expect.poll(() => fileiras(cards)).toEqual([4])
    const arquivado = cards.filter({ hasText: 'Velho' })
    await arquivado.click()
    await expect(page.getByRole('heading', { level: 2 })).toContainText('Velho')
    await esperarTotalEPrazoAlinhados(cards)
    const alturaAntes = await altura(trilho(page))

    await page.getByRole('button', { name: /^Fatura anterior/ }).click()
    await expect(arquivado).toContainText(/voltar para/)
    await esperarTotalEPrazoAlinhados(cards)
    expect(
      Math.abs((await altura(trilho(page))) - alturaAntes),
      'o trilho mudou de altura'
    ).toBeLessThanOrEqual(1)
  })
})
