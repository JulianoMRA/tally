import type { ElectronApplication, Page } from '@playwright/test'

/**
 * Semeia a base pelo IPC, dentro do renderer, em vez de dirigir o formulário.
 *
 * Os specs existentes semeiam clicando pela UI, o que custa dezenas de
 * interações por teste e transforma qualquer mudança de layout em quebra em
 * cascata. Para os gates que só precisam de *dados na tela* — varredura axe,
 * navegação por teclado, folha de contato visual — passar pelo formulário não
 * agrega cobertura, só tempo e acoplamento.
 *
 * Os tipos do `window.api` vivem no projeto do renderer e não são visíveis
 * aqui, então a fatia usada é declarada localmente. É pouca superfície e
 * quebrar o contrato quebra o `page.evaluate` na hora.
 */

type Cartao = { id: number }
type Categoria = { id: number }

type ApiSeed = {
  cartao: { create: (i: unknown) => Promise<Cartao> }
  categoria: { create: (i: unknown) => Promise<Categoria> }
  despesa: {
    criarUnicaCredito: (i: unknown) => Promise<unknown>
    criarParceladaCredito: (i: unknown) => Promise<unknown>
    criarAssinaturaCredito: (i: unknown) => Promise<unknown>
    criarUnicaForaCartao: (i: unknown) => Promise<unknown>
    listarDespesas: (i: unknown) => Promise<{ id: number; descricao: string }[]>
    definirNotaETags: (i: unknown) => Promise<unknown>
  }
  renda: { criarRecorrente: (i: unknown) => Promise<unknown> }
  recebimento: { criarAvulso: (i: unknown) => Promise<unknown> }
  orcamento: { definirLimite: (i: unknown) => Promise<unknown> }
}

export type DadosSemeados = {
  /** Mês de referência do "hoje" da máquina, no formato YYYY-MM. */
  mesAtual: string
}

/**
 * Base representativa: dois cartões, cinco categorias, despesas de todos os
 * tipos (única, parcelada, assinatura, fora do cartão), renda recorrente,
 * recebimento avulso, limites de orçamento em três estados (dentro, atenção,
 * estourado) e uma despesa com nota e tags.
 */
export async function semear(app: ElectronApplication): Promise<{
  page: Page
  dados: DadosSemeados
}> {
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  const dados = await page.evaluate(async () => {
    const api = (window as unknown as { api: ApiSeed }).api
    const hoje = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const emDias = (dias: number) => {
      const x = new Date(hoje)
      x.setDate(x.getDate() + dias)
      return iso(x)
    }

    const nubank = await api.cartao.create({
      nome: 'Nubank Seed',
      diaFechamento: 3,
      diaVencimento: 10,
      cor: '#5a4a8a'
    })
    const inter = await api.cartao.create({
      nome: 'Inter Seed',
      diaFechamento: 25,
      diaVencimento: 5,
      cor: '#a88454'
    })

    const cats: Record<string, Categoria> = {}
    for (const [nome, tipo, cor] of [
      ['Mercado', 'Despesa', '#5b7a5e'],
      ['Transporte', 'Despesa', '#a88454'],
      ['Lazer', 'Despesa', '#8c3b2e'],
      ['Casa', 'Despesa', '#3f6e47'],
      ['Assinaturas', 'Despesa', '#5a4a8a']
    ] as const) {
      cats[nome] = await api.categoria.create({ nome, tipo, cor })
    }

    await api.despesa.criarUnicaCredito({
      descricao: 'Mercado da semana',
      categoriaId: cats.Mercado.id,
      cartaoId: nubank.id,
      valorCentavos: 32000,
      dataCompra: emDias(0)
    })
    await api.despesa.criarParceladaCredito({
      descricao: 'Notebook em doze vezes',
      categoriaId: cats.Casa.id,
      cartaoId: inter.id,
      totalParcelas: 12,
      valorTotalCentavos: 480000,
      dataCompra: emDias(0)
    })
    await api.despesa.criarAssinaturaCredito({
      descricao: 'Streaming mensal',
      categoriaId: cats.Assinaturas.id,
      cartaoId: nubank.id,
      valorMensalCentavos: 3990,
      dataInicio: emDias(-40)
    })
    await api.despesa.criarUnicaForaCartao({
      descricao: 'Feira no Pix',
      categoriaId: cats.Mercado.id,
      formaPagamento: 'Pix',
      valorCentavos: 8500,
      dataCompra: emDias(0)
    })

    await api.renda.criarRecorrente({
      nome: 'Bolsa Seed',
      valorPadraoCentavos: 90000,
      diaEsperado: 5,
      dataInicio: emDias(-60)
    })
    await api.recebimento.criarAvulso({
      nome: 'Freela Seed',
      valorCentavos: 150000,
      dataEsperada: emDias(0)
    })

    // Três estados do painel de orçamento na mesma tela.
    await api.orcamento.definirLimite({
      categoriaId: cats.Mercado.id,
      valorLimiteCentavos: 100000,
      mesReferencia: null
    })
    await api.orcamento.definirLimite({
      categoriaId: cats.Casa.id,
      valorLimiteCentavos: 30000,
      mesReferencia: null
    })
    await api.orcamento.definirLimite({
      categoriaId: cats.Lazer.id,
      valorLimiteCentavos: 20000,
      mesReferencia: null
    })

    const despesas = await api.despesa.listarDespesas({})
    const comTags = despesas.find((d) => d.descricao === 'Notebook em doze vezes')
    if (comTags) {
      await api.despesa.definirNotaETags({
        despesaId: comTags.id,
        nota: 'Reembolsavel pelo trabalho',
        tags: ['trabalho', 'eletronicos']
      })
    }

    return { mesAtual: iso(hoje).slice(0, 7) }
  })

  // O renderer precisa reler tudo: os hooks carregaram antes do seed.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  return { page, dados }
}
