import type { Page } from '@playwright/test'

/**
 * Registra um pagamento parcial de R$ 100,00 na fatura corrente do "Inter Seed".
 *
 * Existe pelo mesmo motivo de `levarFaturasAoFimDoCiclo`: o `semear` não cria
 * pagamento parcial nenhum, então a faixa com "Falta pagar", a lista de
 * pagamentos e a linha de contexto do trilho não renderizavam durante a
 * varredura axe. Estado que só existe com um dado que a semente não produz é
 * exatamente onde um contraste reprovado já se escondeu três vezes.
 *
 * É um passo separado, e não uma adição ao `semear`: os specs que compartilham
 * aquele fixture conferem valores de fatura, e um pagamento parcial mudaria o
 * número debaixo deles.
 *
 * O Inter é o primeiro cartão do trilho (ordem alfabética), então a fatura
 * escolhida é a que a tela de Faturas abre sem clique nenhum.
 *
 * Devolve o mês de referência dessa fatura. A compra da semente é de hoje e o
 * Inter fecha no dia 25: do dia 25 em diante a fatura é a do mês que vem, e a
 * Visão mensal, que abre no mês corrente, não mostraria o pagamento. Quem varre
 * a Visão mensal navega até o mês devolvido em vez de contar com o calendário.
 */

type FaturaSeed = {
  fatura: { id: number; status: { kind: 'Aberta' | 'Fechada' | 'Paga' } }
  mesReferencia: string
  restanteCentavos: number
}

type ApiPagamentoParcial = {
  cartao: { list: (o?: unknown) => Promise<{ id: number; nome: string }[]> }
  fatura: {
    listarResumoPorCartao: (cartaoId: number) => Promise<FaturaSeed[]>
    registrarPagamentoParcial: (i: unknown) => Promise<unknown>
  }
}

/**
 * Requer uma página já semeada por `semear`. Recarrega ao final: os hooks do
 * renderer carregaram antes desta mutação.
 */
export async function registrarPagamentoParcialNaSemente(page: Page): Promise<string> {
  const mesDaFatura = await page.evaluate(async () => {
    const api = (window as unknown as { api: ApiPagamentoParcial }).api
    // Data LOCAL, como o app (`hojeIsoLocal`): `toISOString` é UTC.
    const hoje = new Date()
    const dataPagamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

    const inter = (await api.cartao.list()).find((c) => c.nome === 'Inter Seed')
    if (!inter) throw new Error('Cartão "Inter Seed" não encontrado — rode semear() antes')

    // O resumo vem em ordem de mês: a primeira não paga com valor é a que o
    // trilho mostra como corrente.
    const corrente = (await api.fatura.listarResumoPorCartao(inter.id)).find(
      (f) => f.fatura.status.kind !== 'Paga' && f.restanteCentavos > 10000
    )
    if (!corrente) throw new Error('Nenhuma fatura a pagar no "Inter Seed"')

    await api.fatura.registrarPagamentoParcial({
      faturaId: corrente.fatura.id,
      valorCentavos: 10000,
      dataPagamento
    })
    return corrente.mesReferencia
  })

  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  return mesDaFatura
}
