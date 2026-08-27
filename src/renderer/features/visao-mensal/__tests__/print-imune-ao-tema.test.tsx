// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PrintMensalPage from '../PrintMensalPage'

/**
 * A folha de impressão precisa ser imune ao tema.
 *
 * `PrintMensalPage` não roda na janela principal: o main abre uma
 * `BrowserWindow` oculta, carrega o MESMO bundle em `#/print/:mes` e manda um
 * `printToPDF`. Com o tema escuro gravado, o documento inteiro herdaria a
 * paleta escura — e como a folha fixa `background: #ffffff` mas tira o texto e
 * as réguas de `var(--ink)` e `var(--rule)`, o PDF sairia branco no branco.
 *
 * O guard de cores NÃO pega isso: `print-mensal.module.css` está na lista de
 * arquivos permitidos justamente por causa do branco de papel A4. Por isso o
 * teste é aqui.
 *
 * São duas camadas, e cada uma tem seu teste abaixo:
 *   1. o preload não carimba o tema escuro na rota de impressão;
 *   2. a folha carrega `data-theme="claro"` no próprio elemento.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))

function instalarApi(): void {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        visaoMensal: {
          detalhar: vi.fn().mockResolvedValue({
            mesReferencia: '2026-08',
            totais: {
              entradasRecebidasCentavos: 90000,
              faturasCentavos: 42000,
              foraDoCartaoCentavos: 8500,
              saldoCentavos: 39500
            },
            faturas: [],
            gastosForaCartao: [],
            recebimentos: []
          })
        }
      }
    })
  )
}

describe('folha de impressão — imunidade ao tema', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    vi.unstubAllGlobals()
  })

  // Camada 2: vale para qualquer token que a folha venha a usar, hoje ou
  // depois, e sobrevive a alguém mexer no preload.
  it('fixa a paleta clara na própria subárvore, mesmo com o app no escuro', async () => {
    document.documentElement.setAttribute('data-theme', 'escuro')
    instalarApi()

    render(
      <MemoryRouter initialEntries={['/print/2026-08']}>
        <Routes>
          <Route path="/print/:mes" element={<PrintMensalPage />} />
        </Routes>
      </MemoryRouter>
    )

    const folha = await waitFor(() => {
      const el = document.querySelector('[data-print-pronto]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })

    expect(
      folha.getAttribute('data-theme'),
      'A folha precisa fixar data-theme="claro": sem isso ela herda o tema do ' +
        'documento e o PDF sai com papel branco e tinta quase branca.'
    ).toBe('claro')
  })

  // Camada 1, conferida no fonte: exercitar o preload de verdade exigiria um
  // Electron de pé, e o que importa aqui é que a guarda não desapareça.
  it('o preload não carimba o tema gravado na rota de impressão', () => {
    const preload = readFileSync(
      join(AQUI, '..', '..', '..', '..', '..', 'electron', 'preload.ts'),
      'utf8'
    )

    expect(preload, 'O preload precisa tratar #/print/ antes de carimbar o tema gravado.').toMatch(
      /location\.hash\.startsWith\(\s*['"]#\/print\//
    )
  })

  // O bloco da paleta clara precisa casar com o atributo, senão o
  // data-theme="claro" da folha não resolve token nenhum.
  it('a paleta clara responde ao seletor de atributo, não só ao :root', () => {
    const tokens = readFileSync(join(AQUI, '..', '..', '..', 'styles', 'tokens.css'), 'utf8')

    expect(
      tokens,
      'tokens.css precisa definir a paleta clara também em [data-theme="claro"]: ' +
        'sem esse seletor, fixar o tema numa subárvore não resolve nada.'
    ).toMatch(/\[data-theme\s*=\s*['"]?claro['"]?\s*\]/)
  })
})
