import type { Page } from '@playwright/test'

/**
 * Leva duas faturas antigas ao fim do ciclo de vida: uma Fechada e uma Paga.
 *
 * Existe porque a varredura axe nunca tinha visto esses dois estados. O
 * `semear` cria despesas e faturas, mas jamais fecha ou paga nenhuma, então os
 * badges "Fechada", "Paga" e "Projeção" simplesmente não renderizavam durante o
 * gate de acessibilidade — e um deles reprovava no contraste sem que ninguém
 * soubesse (`--paid` sobre `--income-bg` dava 4,28:1, abaixo dos 4,5 do WCAG AA
 * para texto pequeno). É a mesma mecânica que escondeu o problema do
 * `--pending` até a varredura passar a rodar com dados na tela.
 *
 * É um passo separado, e não uma adição ao `semear`, de propósito: seis specs
 * compartilham aquele fixture, e mexer no estado das faturas mudaria a base
 * debaixo de todos eles. Quem precisa dos estados finais opta por eles aqui.
 *
 * Opera só em meses ANTERIORES ao corrente. A fatura do mês corrente alimenta o
 * total do cartão que `fluxos-fase-8` confere, e fechá-la mudaria esse número.
 */

type FaturaSeed = {
  id: number
  mesReferencia: string
  status: { kind: 'Aberta' | 'Fechada' | 'Paga' }
}

type CartaoSeed = { id: number; nome: string }

type ApiCicloDeVida = {
  cartao: { list: (o?: unknown) => Promise<CartaoSeed[]> }
  categoria: { list: (o?: unknown) => Promise<{ id: number; nome: string }[]> }
  despesa: { criarUnicaCredito: (i: unknown) => Promise<unknown> }
  fatura: {
    listarPorCartao: (cartaoId: number) => Promise<FaturaSeed[]>
    fechar: (faturaId: number) => Promise<FaturaSeed>
    pagar: (faturaId: number, dataPagamento: string) => Promise<FaturaSeed>
  }
}

export type FaturasNoCiclo = {
  /** Mês de referência da fatura que ficou Paga (YYYY-MM). */
  mesPaga: string
  /** Mês de referência da fatura que ficou Fechada (YYYY-MM). */
  mesFechada: string
}

/**
 * Requer uma página já semeada por `semear`. Recarrega ao final: os hooks do
 * renderer carregaram antes destas mutações.
 */
export async function levarFaturasAoFimDoCiclo(page: Page): Promise<FaturasNoCiclo> {
  const resultado = await page.evaluate(async () => {
    const api = (window as unknown as { api: ApiCicloDeVida }).api
    const hoje = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    // Mesma aritmética de calendário do `semear`, e pelo mesmo motivo: dia 1
    // cai antes do fechamento dos dois cartões da seed (3 e 25), então a
    // compra sempre cai na fatura do próprio mês escolhido, independentemente
    // de quando o teste roda.
    const primeiroDiaDeMesesAtras = (meses: number) =>
      iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - meses, 1)))

    const cartoes = await api.cartao.list()
    const nubank = cartoes.find((c) => c.nome === 'Nubank Seed')
    if (!nubank) throw new Error('Cartão "Nubank Seed" não encontrado — rode semear() antes')

    const categorias = await api.categoria.list()
    const mercado = categorias.find((c) => c.nome === 'Mercado')
    if (!mercado) throw new Error('Categoria "Mercado" não encontrada — rode semear() antes')

    // O seed cria uma única fatura antiga (dois meses atrás). Uma terceira
    // compra, um mês mais para trás, dá a segunda fatura antiga que falta para
    // haver Fechada e Paga ao mesmo tempo.
    await api.despesa.criarUnicaCredito({
      descricao: 'Compra de tres meses atras',
      categoriaId: mercado.id,
      cartaoId: nubank.id,
      valorCentavos: 9900,
      dataCompra: primeiroDiaDeMesesAtras(3)
    })

    const mesCorrente = iso(hoje).slice(0, 7)
    const antigas = (await api.fatura.listarPorCartao(nubank.id))
      .filter((f) => f.mesReferencia < mesCorrente)
      .sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia))

    if (antigas.length < 2) {
      throw new Error(`Esperava ao menos 2 faturas antigas, achei ${antigas.length}`)
    }

    // A mais velha vai até o fim (Paga); a seguinte para em Fechada. Pagar
    // exige fechar antes — é o ciclo Aberta → Fechada → Paga do RN-06.
    const [paga, fechada] = antigas

    // Fatura de mês passado JÁ NASCE fechada: a data de fechamento dela ficou
    // no passado, e o app fecha sozinho. Chamar `fechar` nela devolve "Fatura
    // já está fechada" e derruba o fixture. Daí o passo ser condicional em vez
    // de incondicional — o que interessa é o estado final, não o caminho.
    const fecharSePreciso = async (f: FaturaSeed): Promise<void> => {
      if (f.status.kind === 'Aberta') await api.fatura.fechar(f.id)
    }

    await fecharSePreciso(paga)
    if (paga.status.kind !== 'Paga') await api.fatura.pagar(paga.id, iso(hoje))
    await fecharSePreciso(fechada)

    return { mesPaga: paga.mesReferencia, mesFechada: fechada.mesReferencia }
  })

  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  return resultado
}
