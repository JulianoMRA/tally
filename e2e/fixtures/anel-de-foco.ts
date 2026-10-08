import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Medição do anel de foco do design system, que é um `outline` no
 * `:focus-visible` global.
 *
 * Até out/2026 o anel era um `box-shadow`, e três defeitos vinham daí: a sombra
 * própria de um elemento cancelava o anel, o raio forçado no foco mudava a forma
 * de quem tinha raio próprio, e o alto contraste do Windows, que não pinta
 * `box-shadow`, deixava o foco sem indicação nenhuma.
 */

/** O anel como o CSS computado o descreve. */
export type Anel = {
  estilo: string
  largura: string
  cor: string
  espaco: string
}

/**
 * Fora do elemento, como em quase tudo, ou por dentro, para o que encosta na
 * borda de um recipiente que recorta o que passa dela.
 */
export type VarianteDoAnel = 'fora' | 'dentro'

/**
 * O anel que os tokens produzem, lido de uma sonda. Comparar com o token, e não
 * com um valor escrito aqui, é o que diz que o elemento usa o anel do design
 * system, e não um outline qualquer.
 *
 * Sem os tokens a sonda responde `none`: conferir isso evita que sonda e
 * elemento respondam `none` os dois e o caso passe sem anel nenhum na tela.
 */
export async function anelDoDesignSystem(
  page: Page,
  variante: VarianteDoAnel = 'fora'
): Promise<Anel> {
  const anel = await page.evaluate((v) => {
    const sonda = document.createElement('div')
    sonda.style.outline = 'var(--focus-ring-width) solid var(--focus-ring-color)'
    sonda.style.outlineOffset =
      v === 'fora' ? 'var(--focus-ring-offset)' : 'var(--focus-ring-offset-inset)'
    document.body.appendChild(sonda)
    const estilo = getComputedStyle(sonda)
    const lido = {
      estilo: estilo.outlineStyle,
      largura: estilo.outlineWidth,
      cor: estilo.outlineColor,
      espaco: estilo.outlineOffset
    }
    sonda.remove()
    return lido
  }, variante)

  expect(anel.estilo, 'os tokens do anel não produzem outline').toBe('solid')
  const espaco = parseFloat(anel.espaco)
  if (variante === 'fora') {
    expect(espaco, 'o anel de fora não fica fora do elemento').toBeGreaterThan(0)
  } else {
    expect(espaco, 'o anel de dentro não fica dentro do elemento').toBeLessThan(0)
  }
  return anel
}

/** O outline computado do elemento que está com o foco. */
export async function anelDoFoco(page: Page): Promise<Anel> {
  return page.evaluate(() => {
    const estilo = getComputedStyle(document.activeElement ?? document.body)
    return {
      estilo: estilo.outlineStyle,
      largura: estilo.outlineWidth,
      cor: estilo.outlineColor,
      espaco: estilo.outlineOffset
    }
  })
}

/** O que a varredura percorre: a moldura (barra de título e sidebar) ou a tela aberta. */
export type RegiaoDoFoco = 'moldura' | 'tela'

export type ProblemasDeFoco = {
  /** Focados sem o anel do design system; nos campos, sem o halo e o outline transparente. */
  semAnel: string[]
  /** O anel passa da borda de um recipiente que recorta, ou da janela. */
  cortados: string[]
  /** O raio muda quando o foco chega, e com ele a forma do elemento. */
  mudamDeForma: string[]
}

export type ResultadoDaVarredura = {
  /** Tudo que recebeu foco na região, na ordem do Tab. */
  focados: string[]
  problemas: ProblemasDeFoco
}

type EstadoDaVarredura = {
  ids: WeakMap<Element, number>
  proximo: number
  anterior: { el: Element; raio: string; descricao: string } | null
}

type JanelaDaVarredura = { __varreduraDeFoco: EstadoDaVarredura }

type EntradaDoPasso = { regiao: RegiaoDoFoco; fora: Anel; dentro: Anel }

type Passo = {
  /** `null` quando o foco está no `body`: entre o último focável e o primeiro. */
  id: number | null
  naRegiao: boolean
  descricao: string
  semAnel: string | null
  cortado: string | null
  mudouDeForma: string | null
}

/**
 * Um passo da varredura, rodado na página depois de cada Tab. Vai inteiro para
 * o `page.evaluate`, por isso não usa nada de fora dele.
 */
const medirPasso = async ({ regiao, fora, dentro }: EntradaDoPasso): Promise<Passo> => {
  const estado = (window as unknown as JanelaDaVarredura).__varreduraDeFoco
  const px = (valor: string): number => parseFloat(valor) || 0
  const transparente = (cor: string): boolean =>
    cor === 'transparent' || /^rgba\(.*,\s*0\)$/.test(cor)
  const descrever = (el: Element, comNome = true): string => {
    // `_btn_rsm2p_1` vira `btn`: o hash do CSS Module não diz qual elemento é.
    const classes = [...el.classList]
      .map((c) => c.replace(/^_(.+)_[a-z0-9]{5}_\d+$/, '$1'))
      .join('.')
    const base = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classes ? `.${classes}` : ''}`
    if (!comNome) return base
    const rotulo =
      el.getAttribute('aria-label') ||
      (el as HTMLInputElement).labels?.[0]?.textContent ||
      el.textContent ||
      el.getAttribute('title') ||
      ''
    return `${base} "${rotulo.replace(/\s+/g, ' ').trim().slice(0, 40)}"`
  }

  // O raio de quem acabou de perder o foco, contra o que ele tinha com o foco.
  let mudouDeForma: string | null = null
  const anterior = estado.anterior
  estado.anterior = null
  if (anterior && anterior.el.isConnected && anterior.el !== document.activeElement) {
    const raio = getComputedStyle(anterior.el).borderRadius
    if (raio !== anterior.raio) {
      mudouDeForma = `${anterior.descricao}: raio ${anterior.raio} com foco, ${raio} sem`
    }
  }

  const el = document.activeElement
  if (!el || el === document.body || el === document.documentElement) {
    return { id: null, naRegiao: false, descricao: '', semAnel: null, cortado: null, mudouDeForma }
  }
  let id = estado.ids.get(el)
  if (id === undefined) {
    id = estado.proximo++
    estado.ids.set(el, id)
  }

  // A barra de título é o pai do h1; a sidebar é o único `aside` do app.
  const barra = document.querySelector('h1')?.parentElement ?? null
  const naMoldura = el.closest('aside') !== null || (barra?.contains(el) ?? false)
  const naRegiao = (regiao === 'moldura') === naMoldura
  const descricao = descrever(el)
  if (!naRegiao) {
    return { id, naRegiao, descricao, semAnel: null, cortado: null, mudouDeForma }
  }

  // Centralizado, o elemento não fica rente à borda de quem rola só porque o
  // Tab o trouxe até ali: o corte que sobra é o da estrutura da tela.
  el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
  await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)))
  const estilo = getComputedStyle(el)
  estado.anterior = { el, raio: estilo.borderRadius, descricao }

  // O input de arquivo cobre a zona de arrastar com `opacity: 0`: o anel dele
  // não aparece, e quem precisa mostrá-lo é um ancestral visível.
  const caixa = el.getBoundingClientRect()
  let opacidade = 1
  for (let a: Element | null = el; a; a = a.parentElement) {
    opacidade *= px(getComputedStyle(a).opacity)
  }
  let alvo: Element | null = el
  if (opacidade < 0.1 || caixa.width * caixa.height <= 1) {
    alvo = null
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a)
      if (s.outlineStyle !== 'none' && !transparente(s.outlineColor)) {
        alvo = a
        break
      }
    }
  }
  if (!alvo) {
    return {
      id,
      naRegiao,
      descricao,
      semAnel: `${descricao}: o elemento não aparece, e nenhum ancestral mostra o anel`,
      cortado: null,
      mudouDeForma
    }
  }

  const s = alvo === el ? estilo : getComputedStyle(alvo)
  const anel = {
    estilo: s.outlineStyle,
    largura: s.outlineWidth,
    cor: s.outlineColor,
    espaco: s.outlineOffset
  }
  const igual = (a: Anel, b: Anel): boolean =>
    a.estilo === b.estilo && a.largura === b.largura && a.cor === b.cor && a.espaco === b.espaco
  const descreverAnel = `outline ${anel.estilo} ${anel.largura} ${anel.cor} a ${anel.espaco}`

  // Input e Select têm o foco próprio: borda da marca e halo. O outline deles é
  // transparente, e só aparece no alto contraste. Campo sem halo, como a nota de
  // Saídas, mostra o anel como o resto.
  const ehCampo =
    s.boxShadow !== 'none' &&
    el.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="range"]), select, textarea'
    )
  let semAnel: string | null = null
  if (ehCampo && alvo === el) {
    const contornoTransparente =
      anel.estilo === fora.estilo &&
      anel.largura === fora.largura &&
      anel.espaco === fora.espaco &&
      transparente(anel.cor)
    if (!contornoTransparente) {
      semAnel = `${descricao}: campo com halo e ${descreverAnel}`
    }
  } else if (!igual(anel, fora) && !igual(anel, dentro)) {
    const onde = alvo === el ? '' : ` (anel em ${descrever(alvo, false)})`
    semAnel = `${descricao}${onde}: ${descreverAnel}`
  }

  // Quanto o indicador passa da borda do elemento. O outline, quando aparece;
  // senão a sombra, que é o halo dos campos e era o anel até out/2026.
  const contornoVisivel = anel.estilo !== 'none' && !transparente(anel.cor) && px(anel.largura) > 0
  const extensaoDaSombra = Math.max(
    0,
    ...(s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/))
      .filter((parte) => !parte.includes('inset'))
      .map((parte) => {
        const [x = 0, y = 0, desfoque = 0, espalhamento = 0] = (
          parte.match(/-?\d*\.?\d+px/g) ?? []
        ).map(parseFloat)
        return Math.max(Math.abs(x), Math.abs(y)) + desfoque + espalhamento
      })
  )
  const extensao = contornoVisivel
    ? Math.max(0, px(anel.espaco) + px(anel.largura))
    : extensaoDaSombra

  const r = alvo.getBoundingClientRect()
  const ladosCortados = (borda: {
    esquerda: number
    topo: number
    direita: number
    base: number
  }): string[] =>
    [
      r.top - extensao < borda.topo - 0.5 ? 'topo' : '',
      r.right + extensao > borda.direita + 0.5 ? 'direita' : '',
      r.bottom + extensao > borda.base + 0.5 ? 'base' : '',
      r.left - extensao < borda.esquerda - 0.5 ? 'esquerda' : ''
    ].filter(Boolean)

  // Só o recipiente mais próximo que corta: os de fora cortam por consequência.
  let cortado: string | null = null
  for (let a = alvo.parentElement; a && !cortado; a = a.parentElement) {
    const sa = getComputedStyle(a)
    if (sa.overflowX === 'visible' && sa.overflowY === 'visible') continue
    const ra = a.getBoundingClientRect()
    const esquerda = ra.left + a.clientLeft
    const topo = ra.top + a.clientTop
    const lados = ladosCortados({
      esquerda,
      topo,
      direita: esquerda + a.clientWidth,
      base: topo + a.clientHeight
    })
    if (lados.length > 0) {
      cortado = `${descricao}: cortado por ${descrever(a, false)} (${lados.join(', ')})`
    }
  }
  if (!cortado) {
    const lados = ladosCortados({ esquerda: 0, topo: 0, direita: innerWidth, base: innerHeight })
    if (lados.length > 0) cortado = `${descricao}: cortado pela janela (${lados.join(', ')})`
  }

  return { id, naRegiao, descricao, semAnel, cortado, mudouDeForma }
}

const LIMITE_DE_TABS = 300

/**
 * Percorre pelo Tab tudo que recebe foco na região, a partir de onde o foco
 * está, até dar a volta. Devolve o que foi focado e o que destoa do anel.
 *
 * A volta inteira, e não só os primeiros: o Tab passa pela moldura antes e
 * depois da tela, e quem está antes do ponto de partida também conta.
 */
export async function varrerFoco(page: Page, regiao: RegiaoDoFoco): Promise<ResultadoDaVarredura> {
  const fora = await anelDoDesignSystem(page, 'fora')
  const dentro = await anelDoDesignSystem(page, 'dentro')
  await page.evaluate(() => {
    const estado: EstadoDaVarredura = { ids: new WeakMap(), proximo: 1, anterior: null }
    ;(window as unknown as JanelaDaVarredura).__varreduraDeFoco = estado
  })

  const focados: string[] = []
  const problemas: ProblemasDeFoco = { semAnel: [], cortados: [], mudamDeForma: [] }
  const vistos = new Set<number>()
  for (let i = 0; i < LIMITE_DE_TABS; i++) {
    await page.keyboard.press('Tab')
    const passo = await page.evaluate(medirPasso, { regiao, fora, dentro })
    if (passo.mudouDeForma) problemas.mudamDeForma.push(passo.mudouDeForma)
    if (passo.id === null) continue
    if (vistos.has(passo.id)) return { focados, problemas }
    vistos.add(passo.id)
    if (!passo.naRegiao) continue
    focados.push(passo.descricao)
    if (passo.semAnel) problemas.semAnel.push(passo.semAnel)
    if (passo.cortado) problemas.cortados.push(passo.cortado)
  }
  throw new Error(`o Tab não deu a volta em ${LIMITE_DE_TABS} passos`)
}

/**
 * Liga o alto contraste emulado e confere que o Chromium aplicou o modo, e não
 * só a media query: no modo de verdade, `box-shadow` não é pintado. Sem essa
 * prova, os casos de alto contraste passariam com o anel de sombra na tela.
 */
export async function ligarAltoContraste(page: Page): Promise<void> {
  await page.emulateMedia({ forcedColors: 'active' })

  const fotografarSonda = async (sombra: string): Promise<Buffer> => {
    await page.evaluate((valor) => {
      let sonda = document.getElementById('sonda-alto-contraste')
      if (!sonda) {
        sonda = document.createElement('div')
        sonda.id = 'sonda-alto-contraste'
        Object.assign(sonda.style, {
          position: 'fixed',
          left: '300px',
          top: '300px',
          width: '40px',
          height: '40px',
          zIndex: '9999',
          background: 'rgb(0, 0, 255)'
        })
        document.body.appendChild(sonda)
      }
      sonda.style.boxShadow = valor
    }, sombra)
    return page.screenshot({
      clip: { x: 290, y: 290, width: 60, height: 60 },
      animations: 'disabled'
    })
  }

  const comSombra = await fotografarSonda('0 0 0 6px rgb(255, 0, 0)')
  const semSombra = await fotografarSonda('none')
  await page.evaluate(() => document.getElementById('sonda-alto-contraste')?.remove())
  expect(
    comSombra.equals(semSombra),
    'a emulação não aplicou o alto contraste: o box-shadow continua pintado'
  ).toBe(true)
}

/**
 * A faixa em volta do elemento, da borda até a folga, sem o miolo: é ali que o
 * anel aparece. O miolo fica de fora porque o alto contraste repinta a cor que
 * o Playwright usa para esconder o cursor de texto, e o cursor dentro do campo
 * fazia o recorte com foco diferir do sem foco — o caso do campo passou assim,
 * na main, sem anel nenhum na tela.
 */
export async function faixaEmVolta(page: Page, alvo: Locator): Promise<Buffer> {
  const caixa = await alvo.boundingBox()
  if (!caixa) throw new Error('o elemento não está na tela')
  const { x, y, width, height } = caixa
  const folga = 8
  // 1px de distância da borda: o pixel do limite é meio borda, meio fora.
  const espessura = folga - 1
  const lados = [
    { x: x - folga, y: y - folga, width: width + 2 * folga, height: espessura },
    { x: x - folga, y: y + height + 1, width: width + 2 * folga, height: espessura },
    { x: x - folga, y, width: espessura, height },
    { x: x + width + 1, y, width: espessura, height }
  ]
  const imagens: Buffer[] = []
  for (const clip of lados) {
    imagens.push(await page.screenshot({ clip, animations: 'disabled' }))
  }
  return Buffer.concat(imagens)
}
