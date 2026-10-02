// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { FaturaResumida, VisaoMensalDetalhada } from '@shared/ipc/visao-mensal'
import PrintMensalPage from '../PrintMensalPage'

/**
 * RF-EXP-02 — a tabela de faturas do PDF com pagamento parcial (RN-10).
 *
 * "Saídas", no topo da folha, vem da RN-08 e conta cada fatura pelo que falta
 * pagar. Com a tabela mostrando só o total, a soma das linhas deixaria de bater
 * com o número do topo, e a folha impressa não tem tela ao lado para explicar.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))

function fatura(
  id: number,
  cartaoNome: string,
  totalCentavos: number,
  pagoParcialCentavos = 0
): FaturaResumida {
  return {
    fatura: {
      id,
      cartaoId: id,
      mesReferencia: '2026-08',
      dataFechamento: '2026-08-05',
      dataVencimento: '2026-08-12',
      status: { kind: 'Aberta' },
      createdAt: '2026-08-01',
      updatedAt: '2026-08-01'
    },
    cartaoNome,
    cartaoCor: '#ff7a00',
    totalCentavos,
    pagoParcialCentavos,
    restanteCentavos: Math.max(0, totalCentavos - pagoParcialCentavos)
  }
}

function instalarApi(faturas: FaturaResumida[]): void {
  const saidas = faturas.reduce((s, f) => s + f.restanteCentavos, 0)
  const detalhe: VisaoMensalDetalhada = {
    mesReferencia: '2026-08',
    faturas,
    gastosForaCartao: [],
    recebimentos: [],
    totais: {
      totalSaidasCentavos: saidas,
      totalEntradasRecebidasCentavos: 0,
      totalEntradasProjetadasCentavos: 0,
      saldoRealizadoCentavos: -saidas,
      saldoProjetadoCentavos: -saidas
    }
  }
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { visaoMensal: { detalhar: vi.fn().mockResolvedValue(detalhe) } }
    })
  )
}

async function renderFolha(): Promise<HTMLElement> {
  render(
    <MemoryRouter initialEntries={['/print/2026-08']}>
      <Routes>
        <Route path="/print/:mes" element={<PrintMensalPage />} />
      </Routes>
    </MemoryRouter>
  )
  const titulo = await screen.findByRole('heading', { name: /^Faturas/ })
  const tabela = titulo.parentElement?.querySelector('table')
  if (!tabela) throw new Error('tabela de faturas não encontrada')
  return tabela as HTMLElement
}

function cabecalhos(tabela: HTMLElement): string[] {
  return within(tabela)
    .getAllByRole('columnheader')
    .map((th) => th.textContent ?? '')
}

function celulas(tabela: HTMLElement, cartao: string): string[] {
  const linha = within(tabela).getByText(cartao).closest('tr')
  if (!linha) throw new Error(`linha de ${cartao} não encontrada`)
  return [...linha.querySelectorAll('td')].map((td) => td.textContent ?? '')
}

describe('folha de impressão — faturas com pagamento parcial', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sem pagamento parcial no mês, a tabela é a de sempre: só o Total', async () => {
    instalarApi([fatura(1, 'Inter', 80000), fatura(2, 'Nubank', 50000)])

    const tabela = await renderFolha()

    expect(cabecalhos(tabela)).toEqual(['Cartão', 'Vencimento', 'Status', 'Total'])
    expect(celulas(tabela, 'Inter').at(-1)).toMatch(/^R\$\s*800,00$/)
  })

  it('com pagamento parcial em alguma fatura, ganha Parciais e Líquido', async () => {
    instalarApi([fatura(1, 'Inter', 80000, 20000), fatura(2, 'Nubank', 50000)])

    const tabela = await renderFolha()

    expect(cabecalhos(tabela)).toEqual([
      'Cartão',
      'Vencimento',
      'Status',
      'Total',
      'Parciais',
      'Líquido'
    ])
  })

  it('cada linha traz o total, o que foi pago em parciais e o líquido', async () => {
    instalarApi([fatura(1, 'Inter', 80000, 20000), fatura(2, 'Nubank', 50000)])

    const tabela = await renderFolha()

    const inter = celulas(tabela, 'Inter').slice(-3)
    expect(inter[0]).toMatch(/^R\$\s*800,00$/)
    expect(inter[1]).toMatch(/^R\$\s*200,00$/)
    expect(inter[2]).toMatch(/^R\$\s*600,00$/)

    // A fatura sem pagamento, na mesma tabela: parciais zerado, líquido = total.
    const nubank = celulas(tabela, 'Nubank').slice(-3)
    expect(nubank[0]).toMatch(/^R\$\s*500,00$/)
    expect(nubank[1]).toMatch(/^R\$\s*0,00$/)
    expect(nubank[2]).toMatch(/^R\$\s*500,00$/)
  })

  // É a conta que a folha precisa fechar sozinha: os líquidos somam as saídas.
  it('a soma da coluna Líquido é o valor de "Saídas" no topo da folha', async () => {
    instalarApi([fatura(1, 'Inter', 80000, 20000), fatura(2, 'Nubank', 50000)])

    await renderFolha()

    const saidas = screen.getByText('Saídas').parentElement
    expect(saidas?.textContent).toMatch(/R\$\s*1\.100,00/)
  })

  // Conferida no fonte, como a guarda do preload em `print-imune-ao-tema`: o
  // jsdom não aplica CSS Module. As colunas de valor saíam alinhadas à esquerda
  // porque `.tabela th, .tabela td` vence `.num` sozinha — e com três colunas
  // de número lado a lado o desalinho deixou de passar despercebido.
  it('a regra das colunas de valor vence o alinhamento padrão da tabela', () => {
    const css = readFileSync(join(AQUI, '..', 'print-mensal.module.css'), 'utf8')

    expect(
      css,
      'A regra precisa ser `.tabela .num`: `.num` sozinha perde para `.tabela td`.'
    ).toMatch(/\.tabela \.num\s*\{[^}]*text-align:\s*right/)
    expect(css).not.toMatch(/^\.num\s*\{/m)
  })
})
