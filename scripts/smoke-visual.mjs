/**
 * Folha de contato visual do app.
 *
 * Sobe o Electron empacotado com uma base isolada, semeia dados representativos
 * pelo IPC e captura as 8 telas em três larguras, mais alguns estados que só
 * existem sob interação (menu de ações aberto, modal, foco de teclado).
 *
 * NÃO é regressão visual automatizada: não há baseline nem comparação. É
 * material para revisão humana antes de uma release, e foi como a auditoria de
 * ago/2026 encontrou a maior parte dos problemas de layout — rodar o app e
 * olhar as telas lado a lado achou o que nenhum teste pegava.
 *
 *   npm run build && npm run smoke:visual
 *
 * As imagens vão para `smoke-visual/` (gitignored).
 *
 * Duas variáveis de ambiente:
 *
 *   SMOKE_OUT    pasta de saída, para comparar duas execuções por SHA-256.
 *   SMOKE_TEMA   `claro` (padrão) ou `escuro`.
 *
 * O tema é gravado no settings.json da base isolada ANTES de o app subir: o
 * preload lê de lá de forma síncrona, e carimbar depois pela UI capturaria a
 * primeira tela ainda no tema anterior.
 */
import { _electron as electron } from '@playwright/test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const SAIDA = process.env.SMOKE_OUT ?? join(RAIZ, 'smoke-visual')
const ENTRADA = join(RAIZ, 'out', 'main', 'index.cjs')
const TEMA = process.env.SMOKE_TEMA ?? 'claro'

if (TEMA !== 'claro' && TEMA !== 'escuro') {
  console.error(`SMOKE_TEMA inválido: "${TEMA}". Use "claro" ou "escuro".`)
  process.exit(1)
}

// Precisa acompanhar as rotas de `src/renderer/router.tsx`, como as listas de
// `a11y.spec.ts` e `alinhamento-paginas.spec.ts`. Simulacao entrou na v1.12.0 e
// aquelas duas foram atualizadas; esta ficou para tras e a tela nova passou
// quatro releases fora da revisao visual.
const ROTAS = [
  ['visao-mensal', '#/mensal'],
  ['faturas', '#/faturas'],
  ['saidas', '#/saidas'],
  ['busca', '#/busca'],
  ['rendas', '#/rendas'],
  ['simulacao', '#/simulacao'],
  ['cartoes', '#/cartoes'],
  ['categorias', '#/categorias'],
  ['importar', '#/importar'],
  ['ajustes', '#/ajustes']
]

// 1024 é a janela mínima usável; 1280 é a padrão do app (1266px de viewport);
// 1760 exercita os dois breakpoints de duas colunas.
const LARGURAS = [1024, 1280, 1760]

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })

const userData = mkdtempSync(join(tmpdir(), 'tally-smoke-'))

// Grava o tema antes do launch. O app lê settings.json no boot — pelo main,
// para o backgroundColor da janela, e pelo preload, para carimbar o atributo
// antes do primeiro paint. Trocar pela UI depois de subir deixaria a primeira
// captura no tema anterior.
writeFileSync(join(userData, 'settings.json'), JSON.stringify({ tema: TEMA }, null, 2), 'utf8')

const app = await electron.launch({
  args: [ENTRADA],
  env: { ...process.env, TALLY_USER_DATA: userData },
  timeout: 60_000
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

// Sem esta conferência, um tema que não pegou geraria 39 capturas claras
// rotuladas como escuras — e a folha de contato passaria a mentir em silêncio,
// que é o pior defeito possível num material de revisão.
const temaAplicado = await page.evaluate(() => document.documentElement.dataset.theme)
if (temaAplicado !== TEMA) {
  console.error(`Tema pedido "${TEMA}" mas o app abriu em "${temaAplicado ?? '(nenhum)'}".`)
  await app.close()
  process.exit(1)
}
console.log(`tema: ${TEMA}`)

const problemas = []
page.on('pageerror', (e) => problemas.push(`[pageerror] ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`[console] ${m.text()}`)
})

async function redimensionar(largura, altura = 900) {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]?.setSize(w, h),
    [largura, altura]
  )
  await page.waitForTimeout(500)
}

/**
 * Espera os graficos terminarem de se desenhar.
 *
 * O recharts anima a entrada da linha por `stroke-dasharray` (1500ms), e o
 * `ir()` esperava 1000ms fixos — ou seja, TODA captura de grafico saia pela
 * metade. Medido: em t=1000ms o dasharray e "531px, 878px" numa linha de 878px;
 * em t=4000ms, "878px, 878px".
 *
 * Isso importa porque uma linha cortada no meio le como grafico quebrado — e o
 * risco maior e o inverso: um grafico de fato quebrado ser descartado como "e
 * so a animacao". Folha de revisao que mente em silencio e o pior defeito que
 * ela pode ter.
 *
 * Mesmo principio do `data-print-pronto` da exportacao em PDF: esperar o
 * marcador, nao dormir um numero. Rota sem grafico resolve na hora.
 *
 * O criterio e a ESTABILIDADE do dasharray, e nao "o comprimento desenhado
 * chegou ao fim". A linha do Saldo tem `strokeDasharray="4 2"` fixo, e o
 * recharts a anima gerando um padrao longo ("4px, 2px, 4px, 2px, ...") em vez
 * de um unico segmento crescente: comparar o primeiro numero com o comprimento
 * total nunca fecharia para ela. Esperar o desenho parar de mudar vale para as
 * duas formas de animacao, e continuaria valendo se o recharts trocar a sua.
 */
async function esperarGraficos() {
  const lerDasharrays = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.recharts-line-curve')]
        .map((c) => window.getComputedStyle(c).strokeDasharray)
        .join('|')
    )

  let anterior = await lerDasharrays()
  if (anterior === '') return // rota sem grafico

  const limite = Date.now() + 8000
  for (;;) {
    await page.waitForTimeout(250)
    const atual = await lerDasharrays()
    if (atual === anterior) return
    anterior = atual
    if (Date.now() > limite) {
      problemas.push('[graficos] a animacao nao estabilizou em 8s; a captura pode sair pela metade')
      return
    }
  }
}

async function ir(hash) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await page.waitForTimeout(1000)
  await esperarGraficos()
}

/**
 * A aba Analise nao e rota: e estado da Visao mensal. Sem este passo os dois
 * graficos do app e o painel de orcamento nunca entram na folha — e foi
 * exatamente nesse ponto cego que o eixo Y cortado sobreviveu ate set/2026.
 */
async function abrirAnalise() {
  await ir('#/mensal')
  await page
    .getByRole('tab', { name: /an[aá]lise/i })
    .first()
    .click({ timeout: 5000 })
  await page.waitForTimeout(600)
  await esperarGraficos()
}

/**
 * A Busca nao consulta nada ao abrir, de proposito (RF-DES-22). Sem clicar em
 * Buscar, a folha registra so o formulario — e a tabela de resultados, que e o
 * que a tela existe para mostrar, nunca aparece na revisao visual. Mesmo ponto
 * cego que a aba Analise tinha antes de `abrirAnalise`.
 */
async function buscarNaBusca() {
  await ir('#/busca')
  await page.getByRole('button', { name: 'Buscar' }).first().click({ timeout: 5000 })
  await page.waitForTimeout(800)
}

async function capturar(nome) {
  await page.screenshot({ path: join(SAIDA, `${nome}.png`) })
  console.log('  ·', nome)
}

/**
 * Leva o foco até `alvo` pela tecla Tab.
 *
 * `.focus()` não serve para fotografar foco de teclado: depois de um clique de
 * mouse, o foco por script não acende `:focus-visible`. A captura
 * `estado-foco-de-teclado` usava `.focus()` e saía idêntica, byte a byte, à
 * captura sem foco — nos dois temas, sem que nada avisasse.
 */
async function tabAte(alvo, limite = 40) {
  for (let i = 0; i < limite; i++) {
    await page.keyboard.press('Tab')
    if (await alvo.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error('o foco não chegou ao alvo pela tecla Tab')
}

/**
 * Captura um estado de foco e confere que ele aparece na imagem: fotografa de
 * novo sem o foco, e as duas precisam diferir. Mesmo princípio da conferência
 * do tema lá em cima — folha de revisão que mente em silêncio é o pior defeito
 * que ela pode ter.
 */
async function capturarFoco(nome) {
  // O estado de foco pode ter transição (o fundo do item de menu, por
  // exemplo); sem a espera a captura sai no meio.
  await page.waitForTimeout(300)
  const comFoco = await page.screenshot({ path: join(SAIDA, `${nome}.png`) })
  await page.evaluate(() => document.activeElement?.blur())
  await page.waitForTimeout(300)
  const semFoco = await page.screenshot()
  if (comFoco.equals(semFoco)) {
    problemas.push(`[foco] "${nome}" saiu igual à tela sem foco: o anel não aparece`)
  }
  console.log('  ·', nome)
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

/** "Julho de 2026": o mês de N meses atrás, como a tela o escreve. */
function mesPorExtenso(mesesAtras) {
  const hoje = new Date()
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, 1)
  return `${MESES[alvo.getMonth()]} de ${alvo.getFullYear()}`
}

await redimensionar(1280)
await page.waitForTimeout(1000)

console.log('primeiro uso (base vazia):')
for (const [nome, hash] of ROTAS) {
  await ir(hash)
  await capturar(`vazio-1280-${nome}`)
}

console.log('semeando…')
await page.evaluate(async () => {
  const api = window.api
  const hoje = new Date()
  // Data LOCAL, como o app (`hojeIsoLocal`). Com `toISOString`, das 21h à
  // meia-noite "hoje" já era amanhã em UTC: a folha de 01/10/2026 saiu com um
  // pagamento parcial de "02/10" numa tela cujos diálogos abriam em 01/10.
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const emDias = (n) => {
    const x = new Date(hoje)
    x.setDate(x.getDate() + n)
    return iso(x)
  }

  const nubank = await api.cartao.create({
    nome: 'Nubank',
    diaFechamento: 3,
    diaVencimento: 10,
    cor: '#5a4a8a'
  })
  const inter = await api.cartao.create({
    nome: 'Inter',
    diaFechamento: 25,
    diaVencimento: 5,
    cor: '#a88454'
  })

  const cats = {}
  for (const [nome, cor] of [
    ['Mercado', '#5b7a5e'],
    ['Transporte', '#a88454'],
    ['Lazer', '#8c3b2e'],
    ['Casa', '#3f6e47'],
    ['Assinaturas', '#5a4a8a'],
    ['Saúde', '#1f6f8b'],
    ['Presentes', '#ff7a00']
  ]) {
    cats[nome] = await api.categoria.create({ nome, cor })
  }

  for (const [descricao, cat, valor, dias] of [
    ['Mercado da semana', 'Mercado', 32000, 0],
    ['Uber para o aeroporto', 'Transporte', 6350, -1],
    ['Cinema com a familia', 'Lazer', 9000, -2]
  ]) {
    await api.despesa.criarUnicaCredito({
      descricao,
      categoriaId: cats[cat].id,
      cartaoId: nubank.id,
      valorCentavos: valor,
      dataCompra: emDias(dias)
    })
  }
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
  // Histórico em meses encerrados: sem ele a sparkline e a média do cartão não
  // têm o que mostrar, e a linha de Cartões volta a parecer cadastro morto.
  // Dia 1 fica antes do fechamento dos dois cartões (3 e 25), então a fatura é
  // sempre a do próprio mês escolhido.
  const primeiroDiaDeMesesAtras = (n) => iso(new Date(hoje.getFullYear(), hoje.getMonth() - n, 1))

  for (const [n, valorNubank, valorInter] of [
    [1, 41000, 38000],
    [2, 52000, 0],
    [3, 33000, 61000],
    [4, 47000, 25000]
  ]) {
    if (valorNubank > 0) {
      await api.despesa.criarUnicaCredito({
        descricao: `Compras de ${n} meses atras`,
        categoriaId: cats.Mercado.id,
        cartaoId: nubank.id,
        valorCentavos: valorNubank,
        dataCompra: primeiroDiaDeMesesAtras(n)
      })
    }
    if (valorInter > 0) {
      await api.despesa.criarUnicaCredito({
        descricao: `Casa, ${n} meses atras`,
        categoriaId: cats.Casa.id,
        cartaoId: inter.id,
        valorCentavos: valorInter,
        dataCompra: primeiroDiaDeMesesAtras(n)
      })
    }
  }

  // Sete categorias com gasto no mês corrente: a pizza da aba Mês (RF-VIS-08)
  // agrupa a partir da sétima em "Outros", e sem isto a fatia nunca entra na
  // folha. Os gastos acima caem em meses diferentes conforme o dia em que o
  // script roda (dependem do fechamento de cada cartão); dia 1 cai antes dos
  // dois fechamentos e conta sempre no mês corrente. Casa e Lazer chegam perto
  // e passam do limite de propósito: com Mercado folgado, os três estados do
  // orçamento aparecem juntos.
  for (const [descricao, cat, valor] of [
    ['Show no fim de semana', 'Lazer', 26000],
    ['Conserto do chuveiro', 'Casa', 25000],
    ['Revisao do carro', 'Transporte', 12000],
    ['Farmacia', 'Saúde', 6000],
    ['Presente de aniversario', 'Presentes', 4500]
  ]) {
    await api.despesa.criarUnicaCredito({
      descricao,
      categoriaId: cats[cat].id,
      cartaoId: nubank.id,
      valorCentavos: valor,
      dataCompra: primeiroDiaDeMesesAtras(0)
    })
  }

  // Categoria arquivada com gasto no mês: Saídas e Busca mostram o nome com o
  // selo "Arquivada" (RF-CAT-02), e sem ela o selo nunca entra na folha.
  // Arquiva DEPOIS de lançar — já arquivada, o cadastro nem a ofereceria.
  const viagem = await api.categoria.create({ nome: 'Viagem', cor: '#2f7f7a' })
  await api.despesa.criarUnicaCredito({
    descricao: 'Passagem de onibus',
    categoriaId: viagem.id,
    cartaoId: nubank.id,
    valorCentavos: 3500,
    dataCompra: primeiroDiaDeMesesAtras(0)
  })
  await api.categoria.arquivar(viagem.id)

  // Uma parcelada e uma recorrente no Pix no mês corrente, e tags: sem elas a
  // folha nunca mostra "1/4 de R$ 480,00", "mensal" fora do cartão nem o filtro
  // de tag de Saídas. Transporte não tem limite de orçamento, então os três
  // estados montados acima (Mercado folgado, Casa perto, Lazer estourado) ficam
  // como estão.
  const pneus = await api.despesa.criarParceladaCredito({
    descricao: 'Pneus novos',
    categoriaId: cats.Transporte.id,
    cartaoId: nubank.id,
    totalParcelas: 4,
    valorTotalCentavos: 48000,
    dataCompra: primeiroDiaDeMesesAtras(0)
  })
  await api.despesa.definirNotaETags({
    despesaId: pneus.despesa.id,
    nota: null,
    tags: ['carro']
  })
  await api.despesa.criarAssinaturaForaCartao({
    descricao: 'Aluguel da garagem',
    categoriaId: cats.Transporte.id,
    formaPagamento: 'Pix',
    valorMensalCentavos: 15000,
    mesInicial: primeiroDiaDeMesesAtras(2).slice(0, 7),
    diaCobranca: 5,
    recorreAte: null
  })

  await api.despesa.criarUnicaForaCartao({
    descricao: 'Feira no Pix',
    categoriaId: cats.Mercado.id,
    formaPagamento: 'Pix',
    valorCentavos: 8500,
    dataCompra: emDias(0)
  })

  await api.renda.criarRecorrente({
    nome: 'Bolsa PET',
    valorPadraoCentavos: 90000,
    diaEsperado: 5,
    dataInicio: emDias(-60)
  })
  await api.recebimento.criarAvulso({
    descricao: 'Freela de design',
    valorCentavos: 150000,
    dataEsperada: emDias(0)
  })

  // Três estados da barra de orçamento na mesma tela.
  for (const [cat, limite] of [
    ['Mercado', 100000],
    ['Casa', 30000],
    ['Lazer', 20000]
  ]) {
    await api.orcamento.definirLimite({
      categoriaId: cats[cat].id,
      valorLimiteCentavos: limite,
      mesReferencia: null
    })
  }

  // Faturas no fim do ciclo e um cartão arquivado com fatura a pagar
  // (RF-CAR-02, RF-FAT-06). Sem isto a folha nunca mostra "paga em", o
  // histórico com as abas "A pagar" e "Pagas" nem o selo "Arquivado" no trilho.
  // A fatura do mês passado do Inter é paga; a de quatro meses atrás fica a
  // pagar, vencida. Fatura de mês passado nasce Aberta e só fecha com a
  // manutenção: fecha antes de pagar, que é o ciclo do RN-06.
  const pagarDoMes = async (cartaoId, mesesAtras, parcialCentavos = 0) => {
    const mes = primeiroDiaDeMesesAtras(mesesAtras).slice(0, 7)
    const fatura = (await api.fatura.listarPorCartao(cartaoId)).find((f) => f.mesReferencia === mes)
    if (!fatura) return
    // O pagamento parcial entra antes de pagar: fatura paga não aceita (RN-10).
    if (parcialCentavos > 0) {
      await api.fatura.registrarPagamentoParcial({
        faturaId: fatura.id,
        valorCentavos: parcialCentavos,
        dataPagamento: fatura.dataFechamento
      })
    }
    if (fatura.status.kind === 'Aberta') await api.fatura.fechar(fatura.id)
    // No vencimento, ou hoje quando ele ainda não chegou: a fatura do mês
    // passado pode vencer neste mês, e a folha mostrava "paga em" com data
    // futura nos primeiros dias dele.
    const hoje = emDias(0)
    const pagaEm = fatura.dataVencimento <= hoje ? fatura.dataVencimento : hoje
    await api.fatura.pagar(fatura.id, pagaEm)
  }
  await pagarDoMes(inter.id, 1)
  // Paga COM pagamento parcial: a faixa diz "Restante pago", e a linha do
  // histórico mostra o contexto do parcial ao lado do selo "Paga". Sem esta
  // fatura a folha só via o pagamento parcial em fatura a pagar.
  await pagarDoMes(inter.id, 3, 20000)

  // Um pagamento parcial na fatura corrente do Inter (RF-FAT-07). Sem ele a
  // folha nunca mostra a faixa com "Falta pagar", a lista de pagamentos nem a
  // linha de contexto do card. O Inter é o primeiro cartão do trilho, então é
  // a fatura que a tela abre sem clique. A escolha é pela data de fechamento,
  // e não pelo status: a fatura de quatro meses atrás também está Aberta neste
  // ponto (só fecha com a manutenção) e vem antes na ordem de mês.
  //
  // Essa de quatro meses atrás, vencida, ganha outro: é a linha do Histórico
  // com o contexto "pagos de", que a fatura corrente não mostra — o histórico
  // só lista meses encerrados.
  const resumoDoInter = await api.fatura.listarResumoPorCartao(inter.id)
  const mesVencido = primeiroDiaDeMesesAtras(4).slice(0, 7)
  for (const [fatura, valorCentavos] of [
    [
      resumoDoInter.find((f) => f.fatura.dataFechamento > emDias(0) && f.restanteCentavos > 15000),
      15000
    ],
    [resumoDoInter.find((f) => f.mesReferencia === mesVencido), 10000]
  ]) {
    if (!fatura) continue
    await api.fatura.registrarPagamentoParcial({
      faturaId: fatura.fatura.id,
      valorCentavos,
      dataPagamento: emDias(0)
    })
  }

  const antigo = await api.cartao.create({
    nome: 'Cartao antigo',
    diaFechamento: 10,
    diaVencimento: 17,
    cor: '#8c3b2e'
  })
  await api.despesa.criarUnicaCredito({
    descricao: 'Ultima compra no cartao antigo',
    categoriaId: cats.Casa.id,
    cartaoId: antigo.id,
    valorCentavos: 27000,
    dataCompra: primeiroDiaDeMesesAtras(1)
  })
  // Uma fatura mais velha, paga: é para ela que a seta "anterior" leva o
  // painel. Com uma fatura só o cartão arquivado nunca saía da corrente, e o
  // card dele nunca mostrava a volta ao lado do selo "Arquivado".
  await api.despesa.criarUnicaCredito({
    descricao: 'Compra mais velha no cartao antigo',
    categoriaId: cats.Casa.id,
    cartaoId: antigo.id,
    valorCentavos: 9000,
    dataCompra: primeiroDiaDeMesesAtras(2)
  })
  await pagarDoMes(antigo.id, 2)
  await api.cartao.arquivar(antigo.id)

  // Quarto cartão do trilho, com três estados que a folha nunca mostrou: o
  // nome que não cabe no card, a fatura comprida e o pagamento parcial nos dois
  // extremos (RN-10). O nome começa com "O" de propósito: o trilho vai em ordem
  // alfabética, e o Inter precisa continuar sendo o cartão que a tela abre sem
  // clique. As compras são de meses à frente: o mês corrente fica como está,
  // com os três estados de orçamento montados acima.
  const diaDeMesesAFrente = (meses, dia) =>
    iso(new Date(hoje.getFullYear(), hoje.getMonth() + meses, dia))
  const ourocard = await api.cartao.create({
    nome: 'Ourocard corporativo Banco do Brasil Visa Infinite',
    diaFechamento: 20,
    diaVencimento: 27,
    cor: '#1f6f8b'
  })

  // Fatura do mês que vem: mais de 30 lançamentos, o tamanho de uma fatura de
  // verdade. É com ela que a tabela passa da dobra.
  for (let i = 1; i <= 32; i++) {
    await api.despesa.criarUnicaCredito({
      descricao: `Compra ${String(i).padStart(2, '0')} da viagem`,
      categoriaId: cats.Transporte.id,
      cartaoId: ourocard.id,
      valorCentavos: 1500 + i * 137,
      dataCompra: diaDeMesesAFrente(1, 1 + (i % 15))
    })
  }
  // Pago a mais: o pagamento parcial só passa do total quando uma despesa sai
  // depois dele. A passagem entra, o pagamento cobre quase tudo, a passagem é
  // excluída — e a faixa precisa dizer quanto sobrou.
  const passagem = await api.despesa.criarUnicaCredito({
    descricao: 'Passagem cancelada',
    categoriaId: cats.Transporte.id,
    cartaoId: ourocard.id,
    valorCentavos: 60000,
    dataCompra: diaDeMesesAFrente(1, 2)
  })
  await api.fatura.registrarPagamentoParcial({
    faturaId: passagem.fatura.id,
    valorCentavos: 150000,
    dataPagamento: emDias(0)
  })
  await api.despesa.excluir({ despesaId: passagem.despesa.id })

  // Quitada por parciais: fatura Aberta aceita o pagamento que cobre tudo, e
  // depois fecha. Fica Fechada sem nada a pagar — "Registrar pagamento
  // parcial" desabilitado, sem aviso de prazo, e só "Marcar como paga" a fazer.
  const curso = await api.despesa.criarUnicaCredito({
    descricao: 'Curso de idiomas',
    categoriaId: cats.Transporte.id,
    cartaoId: ourocard.id,
    valorCentavos: 45000,
    dataCompra: diaDeMesesAFrente(2, 2)
  })
  await api.fatura.registrarPagamentoParcial({
    faturaId: curso.fatura.id,
    valorCentavos: 45000,
    dataPagamento: emDias(0)
  })
  await api.fatura.fechar(curso.fatura.id)

  // Uma cópia de segurança: sem ela a lista de Ajustes só aparece vazia na
  // folha de contato, e o estado que a F9 mexeu — a linha com o menu de ações —
  // fica fora da revisão. Mesmo motivo da semeadura de meses passados acima.
  await api.config.criarBackupAgora()

  const despesas = await api.despesa.listarDespesas({})
  const alvo = despesas.find((d) => d.descricao === 'Notebook em doze vezes')
  if (alvo) {
    await api.despesa.definirNotaETags({
      despesaId: alvo.id,
      nota: 'Reembolsavel pelo trabalho',
      tags: ['trabalho', 'eletronicos']
    })
  }
})

await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1500)

for (const largura of LARGURAS) {
  console.log(`com dados, ${largura}px:`)
  await redimensionar(largura)
  for (const [nome, hash] of ROTAS) {
    await ir(hash)
    await capturar(`cheio-${largura}-${nome}`)
  }
  // Nas tres larguras, e nao uma vez so: os graficos sao o conteudo mais
  // sensivel a largura da tela inteira.
  await abrirAnalise()
  await capturar(`cheio-${largura}-visao-mensal-analise`)

  await buscarNaBusca()
  await capturar(`cheio-${largura}-busca-resultados`)
}

console.log('estados sob interação:')
await redimensionar(1280)
await ir('#/saidas')

try {
  await page
    .getByRole('button', { name: /^Mais ações/ })
    .first()
    .click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await capturar('estado-menu-de-acoes')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Editar', exact: true }).first().click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await capturar('estado-modal-editar')
  await page.keyboard.press('Escape')

  // O formulário de despesa é a maior superfície do app e agora vive num painel
  // sob demanda: sem este estado, ele não entra na folha de contato.
  await page.getByRole('button', { name: '+ Nova saída' }).click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await capturar('estado-painel-nova-saida')
  await page.getByRole('radio', { name: 'Parcelada', exact: true }).click({ timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-painel-parcelada')
  await page.keyboard.press('Escape')

  // Os dois modos que a tela não abre sozinha: agrupada por categoria (seções
  // na ordem do ranking, coluna Origem no lugar da Categoria) e com filtro
  // ativo ("N de M lançamentos" e "Limpar filtros"). Sem eles, a folha só vê
  // a tabela padrão.
  await page.getByLabel('Agrupar por').selectOption('categoria', { timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-saidas-por-categoria')
  await page.getByLabel('Agrupar por').selectOption('origem')
  await page.getByLabel('Filtrar por origem').selectOption({ label: 'Fora do cartão' })
  await page.waitForTimeout(300)
  await capturar('estado-saidas-filtrada')
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click()

  // O histórico de Faturas nasce recolhido: sem abrir, as linhas com "Paga em"
  // e "vencida há N dias" nunca entram na folha.
  await ir('#/faturas')
  await page
    .getByRole('button', { name: /meses anteriores/ })
    .first()
    .click({ timeout: 5000 })
  await page.getByRole('listitem').last().scrollIntoViewIfNeeded({ timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-faturas-historico')

  // O diálogo de pagamento parcial (RF-FAT-07), na fatura do Inter, que já tem
  // um parcial da semente: a descrição mostra o que falta, não o total.
  await page.getByRole('button', { name: 'Registrar pagamento parcial' }).click({ timeout: 5000 })
  await page.getByLabel('Valor (R$)').fill('100,00')
  await page.waitForTimeout(300)
  await capturar('estado-modal-pagamento-parcial')
  await page.keyboard.press('Escape')

  // Marcar como paga virou diálogo (RF-FAT-04). O Nubank da semente abre numa
  // fatura Fechada, que é a única que oferece o botão.
  await page.getByRole('button', { name: /^Nubank/ }).click({ timeout: 5000 })
  await page.getByRole('button', { name: 'Marcar como paga' }).click({ timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-modal-pagar-fatura')
  await page.keyboard.press('Escape')

  // Os dois diálogos de confirmação do painel: o de fechar diz como voltar
  // atrás (RN-06), e o de excluir nomeia a despesa (RF-DES-09). Na fatura
  // corrente do Inter, que está Aberta e tem a compra parcelada da semente.
  await page.getByRole('button', { name: /^Inter/ }).click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await page
    .getByRole('region', { name: 'Resumo da fatura' })
    .getByRole('button', { name: 'Fechar fatura' })
    .click({ timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-confirm-fechar-fatura')
  await page.keyboard.press('Escape')
  await page
    .getByRole('row', { name: /Notebook em doze vezes/ })
    .getByRole('button', { name: /^Mais ações/ })
    .click({ timeout: 5000 })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Excluir', exact: true }).click()
  await page.waitForTimeout(300)
  await capturar('estado-confirm-excluir-despesa')
  await page.keyboard.press('Escape')

  // Foco de teclado nos dois elementos de Faturas que têm sombra própria: era
  // ela que cancelava o anel. Sai do cartão e volta pela tecla — o clique o
  // deixa focado, mas sem `:focus-visible`.
  await page.getByRole('button', { name: /^Inter/ }).click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await capturarFoco('estado-faturas-foco-cartao')

  // O histórico segue aberto desde a captura lá de cima: o estado dele
  // sobrevive à troca de cartão. A conferência é só para a folha não depender
  // disso.
  const expandir = page.getByRole('button', { name: /meses anteriores/ }).first()
  if ((await expandir.getAttribute('aria-expanded')) !== 'true') await expandir.click()
  await expandir.focus()
  await page.keyboard.press('Tab')
  await capturarFoco('estado-faturas-foco-historico')

  // Fatura paga com pagamento parcial: a faixa diz "Restante pago". Aberta
  // pelo histórico, a página vai até o título dela.
  await page
    .getByRole('listitem')
    .filter({ hasText: mesPorExtenso(3) })
    .getByRole('button')
    .click({ timeout: 5000 })
  await page.waitForTimeout(500)
  await capturar('estado-faturas-paga-com-parcial')

  // O cartão de nome comprido abre na fatura longa, com pago a mais.
  await page.getByRole('button', { name: /^Ourocard/ }).click({ timeout: 5000 })
  await page.waitForTimeout(500)
  await capturar('estado-faturas-pago-a-mais')

  // A fatura seguinte dele é a Fechada quitada por parciais.
  await page.getByRole('button', { name: /^Próxima fatura/ }).click({ timeout: 5000 })
  await page.waitForTimeout(500)
  await capturar('estado-faturas-quitada-por-parciais')

  // O cartão arquivado em foco, antes e depois de o painel sair da fatura
  // corrente: é o card em que a volta divide a linha do mês com um selo.
  await page.getByRole('button', { name: /^Cartao antigo/ }).click({ timeout: 5000 })
  await page.waitForTimeout(500)
  await capturar('estado-faturas-arquivado')
  await page.getByRole('button', { name: /^Fatura anterior/ }).click({ timeout: 5000 })
  await page.waitForTimeout(500)
  await capturar('estado-faturas-arquivado-fora-da-corrente')

  // O cadastro de avulso virou painel na F6; sem este estado ele fica fora da
  // folha de contato, como o de Saídas ficava antes.
  await ir('#/rendas')
  await page.getByRole('button', { name: '+ Novo avulso' }).click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await capturar('estado-painel-novo-avulso')
  await page.keyboard.press('Escape')

  // O ColorPicker vive no formulário de cartão, que virou painel na F7: sem
  // abrir, o swatch não existe na página.
  await page.getByRole('link', { name: 'Cartões' }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '+ Novo cartão' }).click({ timeout: 5000 })
  await page.waitForTimeout(400)
  await capturar('estado-painel-novo-cartao')
  // O grupo de cores é uma parada de Tab só, no swatch escolhido — que no
  // cartão novo é a primeira sugestão.
  await tabAte(page.getByRole('radio', { name: 'Verde escuro' }))
  await capturarFoco('estado-foco-de-teclado')
  await page.keyboard.press('Escape')

  // O checkbox nativo não declara raio, e o anel segue a caixa dele: reto.
  await tabAte(page.getByRole('checkbox', { name: 'Mostrar arquivados' }))
  await capturarFoco('estado-foco-checkbox')

  // Alto contraste do Windows, emulado: o tema não pinta `box-shadow`, e o
  // anel de sombra que vigorou até out/2026 sumia nele.
  await page.emulateMedia({ forcedColors: 'active' })
  await tabAte(page.getByRole('button', { name: '+ Novo cartão' }))
  await capturarFoco('estado-foco-alto-contraste')
  // No campo, o tema pinta o outline transparente no lugar do halo.
  // `capturar`, e não `capturarFoco`: o tema repinta o cursor de texto que a
  // captura esconde, e só o cursor já faria as duas fotos diferirem.
  await ir('#/busca')
  await page.getByLabel('Descrição contém').focus()
  await page.waitForTimeout(300)
  await capturar('estado-foco-alto-contraste-campo')
  await page.emulateMedia({ forcedColors: 'none' })

  // A dica da pizza (RF-VIS-08) só existe sob o mouse. "Outros" é o caso mais
  // comprido dela, porque lista as categorias agrupadas. Em 1024 de propósito:
  // em coluna única a pizza fica abaixo da dobra e nenhuma captura em repouso
  // a mostra; aqui ela entra rolada para a vista.
  await redimensionar(1024)
  await ir('#/mensal')
  const outros = page
    .getByRole('list', { name: 'Legenda' })
    .getByRole('listitem')
    .filter({ hasText: 'Outros' })
  await outros.scrollIntoViewIfNeeded({ timeout: 5000 })
  await outros.hover({ timeout: 5000 })
  await page.waitForTimeout(300)
  await capturar('estado-pizza-dica-outros')
} catch (e) {
  problemas.push(`[interação] ${e.message}`)
}

await app.close()
rmSync(userData, { recursive: true, force: true })

console.log(`\nimagens em: ${SAIDA}`)
if (problemas.length > 0) {
  console.log('\nerros observados durante a captura:')
  for (const p of problemas) console.log('  !', p)
  process.exitCode = 1
} else {
  console.log('nenhum erro de console ou de página durante a captura.')
}
