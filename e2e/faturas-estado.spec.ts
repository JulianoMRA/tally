import type { ElectronApplication, Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { focarCartao, irPara } from './fixtures/navegacao'

/**
 * O que a tela de Faturas preserva depois de um clique (RF-FAT-06).
 *
 * Toda ação desmontava o trilho, o painel e o histórico: `carregando` incluía o
 * loading do resumo, que toda ação recarrega. O conteúdo voltava certo, e por
 * isso nenhum spec reclamava — todos esperam o conteúdo. O que não voltava era
 * o estado de quem estava usando: o histórico fechava, o filtro voltava para
 * "Todas", a página voltava ao topo e o foco de teclado caía no `body`.
 *
 * O jsdom cobre o que é estado de componente. Aqui fica o que só existe com
 * layout de verdade: a posição de rolagem e o que está ou não dentro da janela.
 * Por isso as duas faturas da semente são compridas — numa fatura curta a tela
 * inteira cabe na janela, e os três casos passariam sem medir nada.
 */

const CARTAO = 'Inter Estado E2E'
const LINHAS = 35

type ApiSemente = {
  cartao: { create: (i: unknown) => Promise<{ id: number }> }
  categoria: { create: (i: unknown) => Promise<{ id: number }> }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<unknown>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
  }
}

/**
 * Um cartão que fecha no dia 5, com duas faturas compridas e três em sequência:
 *
 * - junho/2026, já fechada: é a linha "A pagar" do histórico;
 * - o mês que vem, dia 3: nasce Aberta em qualquer dia em que o teste rode, e é
 *   a fatura que o painel abre;
 * - uma compra em 3x no mês que vem, para haver duas faturas depois dela.
 */
async function semearFaturasLongas(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await page.evaluate(
    async ({ cartaoNome, linhas }) => {
      const api = (window as unknown as { api: ApiSemente }).api
      const hoje = new Date()
      const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 3)
      const mesQueVem = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-03`

      const cartao = await api.cartao.create({
        nome: cartaoNome,
        diaFechamento: 5,
        diaVencimento: 12,
        cor: '#a88454'
      })
      const categoria = await api.categoria.create({ nome: 'Mercado Estado E2E', cor: '#5b7a5e' })

      for (let i = 1; i <= linhas; i++) {
        const numero = String(i).padStart(2, '0')
        for (const [descricao, dataCompra] of [
          [`Antiga ${numero}`, '2026-06-03'],
          [`Compra ${numero}`, mesQueVem]
        ]) {
          await api.despesa.criarUnicaCredito({
            descricao,
            categoriaId: categoria.id,
            cartaoId: cartao.id,
            valorCentavos: 1000 + i,
            dataCompra
          })
        }
      }
      await api.despesa.criarParceladaCredito({
        descricao: 'Parcelada em tres',
        categoriaId: categoria.id,
        cartaoId: cartao.id,
        totalParcelas: 3,
        valorTotalCentavos: 30000,
        dataCompra: mesQueVem
      })
    },
    { cartaoNome: CARTAO, linhas: LINHAS }
  )

  // O renderer precisa reler tudo: os hooks carregaram antes da semente.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await irPara(page, 'Faturas')
  await focarCartao(page, CARTAO)
  return page
}

/** A rolagem da área de conteúdo: o `PageContainer` é filho direto dela. */
async function rolagem(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('[data-page]')?.parentElement?.scrollTop ?? -1)
}

test.describe('Faturas — o que a tela preserva depois de um clique', () => {
  test('editar uma linha não fecha o histórico nem tira a página do lugar', async ({ app }) => {
    const page = await semearFaturasLongas(app)

    const abas = page.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
    await abas.getByRole('radio', { name: /^A pagar/ }).click()
    const expandir = page.getByRole('button', { name: /meses anteriores/ })
    await expect(expandir).toHaveAttribute('aria-expanded', 'true')

    const linha = page.getByRole('row').filter({ hasText: `Compra ${LINHAS}` })
    await linha.getByRole('button', { name: 'Editar', exact: true }).click()
    const dialogo = page.getByRole('dialog', { name: 'Editar despesa' })
    await expect(dialogo).toBeVisible()
    const rolagemAntes = await rolagem(page)
    expect(
      rolagemAntes,
      'a linha editada está na primeira tela: o caso não mede nada'
    ).toBeGreaterThan(200)

    await dialogo.getByLabel('Descrição').fill(`Compra ${LINHAS} editada`)
    await dialogo.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('cell', { name: `Compra ${LINHAS} editada` })).toBeVisible()

    expect(
      Math.abs((await rolagem(page)) - rolagemAntes),
      'a página saiu do lugar'
    ).toBeLessThanOrEqual(2)
    await expect(expandir).toHaveAttribute('aria-expanded', 'true')
    await expect(abas.getByRole('radio', { name: /^A pagar/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  test('a seta acionada pelo teclado atravessa as faturas sem perder o foco', async ({ app }) => {
    const page = await semearFaturasLongas(app)
    const titulo = page.getByRole('heading', { level: 2 })
    const primeira = (await titulo.textContent()) ?? ''

    await page.getByRole('button', { name: /^Próxima fatura/ }).focus()
    await page.keyboard.press('Enter')
    await expect(titulo).not.toHaveText(primeira)
    const segunda = (await titulo.textContent()) ?? ''

    // Sem focar de novo: a seta era desmontada junto com o painel, e a segunda
    // tecla caía no `body`.
    await page.keyboard.press('Enter')
    await expect(titulo).not.toHaveText(segunda)

    // Era a última fatura: a seta ficou desabilitada e o foco passou para a
    // que continua valendo.
    await expect(page.getByRole('button', { name: /^Fatura anterior/ })).toBeFocused()
  })

  test('abrir uma fatura pelo histórico traz o título dela para a vista', async ({ app }) => {
    const page = await semearFaturasLongas(app)

    await page.getByRole('button', { name: /meses anteriores/ }).click()
    // O clique rola a página até a linha, que fica abaixo de toda a tabela.
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Junho de 2026' })
      .getByRole('button')
      .click()

    const titulo = page.getByRole('heading', { name: /· Junho de 2026$/ })
    await expect(titulo).toBeInViewport()
    await expect(titulo).toBeFocused()
  })
})
