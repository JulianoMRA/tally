import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures/electron-app'
import { abrirAba, irPara } from './fixtures/navegacao'

// Requires a prior `npm run build` to generate out/main/index.cjs

/**
 * Coluna de dinheiro alinhada à direita termina numa borda só: a do rótulo do
 * cabeçalho, a dos valores e a dos subtotais.
 *
 * O `SortableHeader` usava `inline-flex`, e o `text-align: right` que a tela
 * põe na célula não move item de flex — o rótulo ficava na borda ESQUERDA de
 * toda coluna alinhada à direita do app, longe do que nomeia. Em Saídas havia
 * ainda uma terceira borda: o subtotal de cada grupo ocupava a linha inteira e
 * encostava depois da coluna de ações.
 *
 * Nada disso aparece no jsdom, que não faz layout. Aqui a medida é geométrica:
 * a borda direita do TEXTO, via `Range`, e não da caixa — o botão do cabeçalho
 * ocupa a célula inteira, e a caixa dele coincidiria com a dos valores mesmo
 * com o rótulo encostado do outro lado.
 */

const MES = '2026-06'
const TOLERANCIA_PX = 1

type ApiAlinhamento = {
  cartao: { create: (i: unknown) => Promise<{ id: number }> }
  categoria: { create: (i: unknown) => Promise<{ id: number }> }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<unknown>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
    criarUnicaForaCartao: (i: unknown) => Promise<unknown>
  }
  recebimento: { criarAvulso: (i: unknown) => Promise<unknown> }
  fatura: {
    listarPorCartao: (cartaoId: number) => Promise<{ id: number; mesReferencia: string }[]>
  }
}

/**
 * Um mês fixo com as linhas que exercitam cada tabela: compra única, parcelada
 * (cujo impacto divide a célula com o valor de origem), gasto no Pix (o grupo
 * "Fora do cartão" e a tabela da Visão mensal) e uma entrada avulsa (a tabela de
 * recebimentos). Devolve o deep-link da fatura de junho.
 */
async function semear(page: Page): Promise<string> {
  await page.waitForLoadState('domcontentloaded')
  const hashDaFatura = await page.evaluate(async (mes) => {
    const api = (window as unknown as { api: ApiAlinhamento }).api
    // Fecha dia 25: compras até o dia 10 caem na fatura do próprio mês.
    const cartao = await api.cartao.create({
      nome: 'Inter Alinhamento',
      diaFechamento: 25,
      diaVencimento: 5,
      cor: '#a88454'
    })
    const categoria = await api.categoria.create({ nome: 'Mercado Alinhamento', cor: '#5b7a5e' })

    await api.despesa.criarUnicaCredito({
      descricao: 'Compra alinhada',
      categoriaId: categoria.id,
      cartaoId: cartao.id,
      valorCentavos: 123456,
      dataCompra: `${mes}-03`
    })
    await api.despesa.criarParceladaCredito({
      descricao: 'Parcelada alinhada',
      categoriaId: categoria.id,
      cartaoId: cartao.id,
      totalParcelas: 3,
      valorTotalCentavos: 90000,
      dataCompra: `${mes}-05`
    })
    await api.despesa.criarUnicaForaCartao({
      descricao: 'Pix alinhado',
      categoriaId: categoria.id,
      formaPagamento: 'Pix',
      valorCentavos: 8500,
      dataCompra: `${mes}-10`
    })
    await api.recebimento.criarAvulso({
      descricao: 'Freela alinhado',
      valorCentavos: 150000,
      dataEsperada: `${mes}-15`
    })

    const faturas = await api.fatura.listarPorCartao(cartao.id)
    const fatura = faturas.find((f) => f.mesReferencia === mes)
    return `#/faturas?cartaoId=${cartao.id}&faturaId=${fatura?.id}`
  }, MES)

  // Os hooks carregaram antes da semente.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  return hashDaFatura
}

type Bordas = { cabecalho: number; celulas: number[] }

/**
 * Borda direita do texto do cabeçalho `rotulo` e de toda célula que COMEÇA na
 * coluna dele. Contar pelo `colSpan` é o que faz o subtotal de grupo entrar na
 * medida: a célula do rótulo do grupo cobre as colunas de texto, e a seguinte
 * cai na coluna de valor.
 */
async function medirColuna(tabela: Locator, rotulo: string): Promise<Bordas> {
  return tabela.evaluate((table, rotuloAlvo) => {
    const bordaDoTexto = (no: Node): number => {
      const range = document.createRange()
      range.selectNodeContents(no)
      return range.getBoundingClientRect().right
    }

    const cabecalhos = [...table.querySelectorAll('thead th')]
    const indice = cabecalhos.findIndex((th) => th.textContent?.includes(rotuloAlvo))
    const th = cabecalhos[indice]
    if (!th) throw new Error(`Coluna "${rotuloAlvo}" não encontrada`)

    const celulas: number[] = []
    for (const linha of table.querySelectorAll('tbody tr')) {
      let coluna = 0
      for (const celula of linha.children) {
        if (coluna === indice) {
          if ((celula.textContent ?? '').trim() !== '') celulas.push(bordaDoTexto(celula))
          break
        }
        coluna += (celula as HTMLTableCellElement).colSpan
        if (coluna > indice) break
      }
    }

    return { cabecalho: bordaDoTexto(th.querySelector('button') ?? th), celulas }
  }, rotulo)
}

function esperarAlinhada({ cabecalho, celulas }: Bordas, quantasCelulas: number): void {
  expect(celulas).toHaveLength(quantasCelulas)
  for (const borda of celulas) {
    expect(Math.abs(borda - cabecalho)).toBeLessThanOrEqual(TOLERANCIA_PX)
  }
}

function tabelaCom(page: Page, texto: string): Locator {
  return page.getByRole('table').filter({ has: page.getByRole('cell', { name: texto }) })
}

test.describe('Alinhamento das colunas de valor', () => {
  test('Saídas: cabeçalho, valores e subtotais terminam na mesma borda', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await irPara(page, 'Saídas')
    await page.getByLabel('Mês', { exact: true }).fill(MES)

    const tabela = tabelaCom(page, 'Compra alinhada')
    await expect(tabela).toBeVisible()

    // Três linhas mais dois subtotais: o do cartão e o de "Fora do cartão".
    esperarAlinhada(await medirColuna(tabela, 'Neste mês'), 5)

    // Com a coluna ativa, a seta entra à esquerda do rótulo e a borda fica.
    const cabecalho = page.getByRole('columnheader', { name: /Neste mês/ })
    await cabecalho.getByRole('button').click()
    await expect(cabecalho).not.toHaveAttribute('aria-sort', 'none')
    esperarAlinhada(await medirColuna(tabela, 'Neste mês'), 5)
  })

  test('Busca: o Impacto alinha com o cabeçalho', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await irPara(page, 'Busca')

    await page.getByLabel('Mês inicial').fill(MES)
    await page.getByLabel('Mês final').fill(MES)
    await page.getByRole('button', { name: 'Buscar' }).click()

    const tabela = tabelaCom(page, 'Compra alinhada')
    await expect(tabela).toBeVisible()
    esperarAlinhada(await medirColuna(tabela, 'Impacto'), 3)
  })

  test('detalhe da fatura: o Valor alinha com o cabeçalho', async ({ app }) => {
    const page = await app.firstWindow()
    const hashDaFatura = await semear(page)

    await page.evaluate((hash) => {
      window.location.hash = hash
    }, hashDaFatura)

    const tabela = tabelaCom(page, 'Compra alinhada')
    await expect(tabela).toBeVisible()
    esperarAlinhada(await medirColuna(tabela, 'Valor'), 2)
  })

  // Status não é dinheiro, mas a coluna também é alinhada à direita e tinha o
  // mesmo defeito — foi a folha de contato que mostrou, não a busca por
  // `colValor` que levantou as outras cinco.
  test('Visão mensal: Valor e Status alinham com o cabeçalho', async ({ app }) => {
    const page = await app.firstWindow()
    await semear(page)
    await irPara(page, 'Visão mensal')
    await page.getByLabel('Mês', { exact: true }).fill(MES)

    const foraDoCartao = tabelaCom(page, 'Pix alinhado')
    await expect(foraDoCartao).toBeVisible()
    esperarAlinhada(await medirColuna(foraDoCartao, 'Valor'), 1)

    await abrirAba(page, 'Análise')
    const recebimentos = tabelaCom(page, 'Freela alinhado')
    await expect(recebimentos).toBeVisible()
    esperarAlinhada(await medirColuna(recebimentos, 'Valor'), 1)
    esperarAlinhada(await medirColuna(recebimentos, 'Status'), 1)
  })
})
