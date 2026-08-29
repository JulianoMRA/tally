import { describe, it, expect } from 'vitest'
import { ehNavegacaoInterna, urlExternaPermitida } from '../navegacao'

const APP_FILE = 'file:///C:/Program%20Files/Tally/resources/app.asar/out/renderer/index.html'
const APP_DEV = 'http://localhost:5173/'

describe('ehNavegacaoInterna', () => {
  it('aceita o mesmo documento com fragmento diferente — o roteador e hash', () => {
    expect(ehNavegacaoInterna(APP_FILE, `${APP_FILE}#/faturas`)).toBe(true)
    expect(ehNavegacaoInterna(`${APP_FILE}#/mensal`, `${APP_FILE}#/ajustes`)).toBe(true)
    expect(ehNavegacaoInterna(APP_DEV, `${APP_DEV}#/print/2026-08`)).toBe(true)
  })

  it('recusa outro arquivo local, mesmo na pasta do app', () => {
    // A guarda anterior era `url.startsWith('file://')`, que autorizava
    // qualquer caminho do disco a carregar NA janela que mantem o preload.
    expect(
      ehNavegacaoInterna(
        APP_FILE,
        'file:///C:/Program%20Files/Tally/resources/app.asar/out/renderer/outro.html'
      )
    ).toBe(false)
    expect(ehNavegacaoInterna(APP_FILE, 'file:///C:/Users/julia/algo.html')).toBe(false)
  })

  it('recusa tudo quando a janela ainda nao carregou pagina', () => {
    // `url.startsWith(win.webContents.getURL())` virava `startsWith('')`, que e
    // verdadeiro para qualquer string: a guarda inteira desaparecia.
    expect(ehNavegacaoInterna('', 'https://exemplo.invalido')).toBe(false)
    expect(ehNavegacaoInterna('', APP_FILE)).toBe(false)
  })

  it('recusa host que apenas comeca com o host do dev server', () => {
    // `url.startsWith(ELECTRON_RENDERER_URL)` casava por prefixo de string, e
    // 'http://localhost:5173.exemplo.invalido' comeca com 'http://localhost:5173'.
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:5173.exemplo.invalido/')).toBe(false)
  })

  it('recusa porta diferente, protocolo diferente e caminho diferente', () => {
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:9999/')).toBe(false)
    expect(ehNavegacaoInterna(APP_DEV, 'https://localhost:5173/')).toBe(false)
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:5173/outra')).toBe(false)
  })

  it('recusa destino externo e esquema perigoso', () => {
    expect(ehNavegacaoInterna(APP_FILE, 'https://exemplo.invalido')).toBe(false)
    expect(ehNavegacaoInterna(APP_FILE, 'javascript:alert(1)')).toBe(false)
    expect(ehNavegacaoInterna(APP_FILE, 'data:text/html,<script>1</script>')).toBe(false)
  })

  it('recusa URL malformada dos dois lados em vez de lancar', () => {
    expect(ehNavegacaoInterna(APP_FILE, 'nao e uma url')).toBe(false)
    expect(ehNavegacaoInterna('nao e uma url', APP_FILE)).toBe(false)
  })
})

describe('urlExternaPermitida', () => {
  it('devolve a URL normalizada para http e https', () => {
    expect(urlExternaPermitida('https://github.com/JulianoMRA/tally')).toBe(
      'https://github.com/JulianoMRA/tally'
    )
    expect(urlExternaPermitida('http://exemplo.invalido')).toBe('http://exemplo.invalido/')
  })

  it('recusa esquema que nao seja http(s)', () => {
    // Checagem exata de protocolo, nao startsWith: 'javascript:' e 'file:' nunca
    // podem chegar ao shell.openExternal do SO.
    expect(urlExternaPermitida('javascript:alert(1)')).toBeNull()
    expect(urlExternaPermitida('file:///C:/Windows/System32/calc.exe')).toBeNull()
    expect(urlExternaPermitida('data:text/html,oi')).toBeNull()
    expect(urlExternaPermitida('ms-msdt:/id')).toBeNull()
  })

  it('recusa string malformada em vez de lancar', () => {
    expect(urlExternaPermitida('')).toBeNull()
    expect(urlExternaPermitida('nao e uma url')).toBeNull()
  })
})
