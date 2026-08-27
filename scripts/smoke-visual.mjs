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

const ROTAS = [
  ['visao-mensal', '#/mensal'],
  ['faturas', '#/faturas'],
  ['saidas', '#/saidas'],
  ['rendas', '#/rendas'],
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

async function ir(hash) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await page.waitForTimeout(1000)
}

async function capturar(nome) {
  await page.screenshot({ path: join(SAIDA, `${nome}.png`) })
  console.log('  ·', nome)
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
  const iso = (d) => d.toISOString().slice(0, 10)
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
    ['Assinaturas', '#5a4a8a']
  ]) {
    cats[nome] = await api.categoria.create({ nome, tipo: 'Despesa', cor })
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
  const primeiroDiaDeMesesAtras = (n) =>
    iso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - n, 1)))

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
  await page.getByRole('radio', { name: 'Bronze' }).focus()
  await capturar('estado-foco-de-teclado')
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
