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
 */
import { _electron as electron } from '@playwright/test'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const SAIDA = process.env.SMOKE_OUT ?? join(RAIZ, 'smoke-visual')
const ENTRADA = join(RAIZ, 'out', 'main', 'index.cjs')

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
const app = await electron.launch({
  args: [ENTRADA],
  env: { ...process.env, TALLY_USER_DATA: userData },
  timeout: 60_000
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

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
    nome: 'Freela de design',
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
  await page.getByRole('button', { name: /^Mais ações/ }).first().click({ timeout: 5000 })
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

  await page.getByRole('link', { name: 'Cartões' }).click()
  await page.waitForTimeout(600)
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
