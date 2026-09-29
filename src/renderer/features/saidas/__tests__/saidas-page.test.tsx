// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { ToastProvider } from '../../../components/ui'
import { formatBRL } from '../../../lib/format-brl'
import { cartao, categoria, ocorrencia } from '../../../__tests__/__fixtures__/builders'
import SaidasPage from '../SaidasPage'

const INTER = cartao({ id: 1, nome: 'Inter' })
const MORADIA = categoria({ id: 1, nome: 'Moradia' })
const VIAGEM = categoria({ id: 2, nome: 'Viagem', ativo: false })

/**
 * Dublê do `window.api` com o que a tela carrega ao abrir. Cada teste passa as
 * ocorrências do mês; o resto é o cenário comum: um cartão, uma categoria
 * ativa e uma arquivada.
 */
function instalarApi(ocorrencias: OcorrenciaDoMes[]) {
  const api = {
    cartao: { list: vi.fn().mockResolvedValue([INTER]) },
    // Como o repositório: as arquivadas só vêm quando pedidas.
    categoria: {
      list: vi.fn(async (opcoes?: { incluirArquivados?: boolean }) =>
        opcoes?.incluirArquivados ? [MORADIA, VIAGEM] : [MORADIA]
      )
    },
    despesa: {
      listarOcorrenciasDoMes: vi.fn().mockResolvedValue(ocorrencias),
      listarComTags: vi.fn().mockResolvedValue([])
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderizar() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <SaidasPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('SaidasPage — categoria arquivada (RF-CAT-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  // Saídas carregava só as categorias ativas, e uma parcela de categoria
  // arquivada aparecia como "#2".
  it('mostra o nome da categoria arquivada na linha, com o selo', async () => {
    instalarApi([ocorrencia({ descricao: 'Hotel', categoriaId: VIAGEM.id, cartaoId: INTER.id })])
    renderizar()

    const linha = await screen.findByRole('row', { name: /Hotel/ })
    await waitFor(() => expect(within(linha).getByText('Viagem')).toBeTruthy())
    expect(within(linha).getByText('Arquivada')).toBeTruthy()
  })

  // A tela passa a carregar as arquivadas, mas registrar numa categoria
  // arquivada continua fora de alcance.
  it('o cadastro de nova saída oferece só as categorias ativas', async () => {
    instalarApi([ocorrencia({ descricao: 'Hotel', categoriaId: VIAGEM.id, cartaoId: INTER.id })])
    renderizar()
    const usuario = userEvent.setup()
    const linha = await screen.findByRole('row', { name: /Hotel/ })
    await waitFor(() => expect(within(linha).getByText('Viagem')).toBeTruthy())

    await usuario.click(screen.getByRole('button', { name: '+ Nova saída' }))

    const painel = screen.getByRole('dialog', { name: 'Nova saída' })
    // O campo é obrigatório e o rótulo leva o asterisco: "Categoria*".
    const select = within(painel).getByLabelText(/^Categoria/) as HTMLSelectElement
    const opcoes = [...select.options].map((o) => o.textContent ?? '')
    expect(opcoes).toContain('Moradia')
    expect(opcoes.some((texto) => texto.includes('Viagem'))).toBe(false)
  })
})

/**
 * `formatBRL` separa "R$" do número com espaço não quebrável. O Testing Library
 * normaliza o texto da página para espaço comum, mas não o texto procurado.
 */
function brl(centavos: number): string {
  return formatBRL(centavos).replace(/\s/g, ' ')
}

/** O cabeçalho do painel "Lançamentos": título e o resumo ao lado. */
function cabecalhoDoPainel(): HTMLElement {
  const titulo = screen.getByRole('heading', { name: 'Lançamentos' })
  if (!titulo.parentElement) throw new Error('painel sem cabeçalho')
  return titulo.parentElement
}

describe('SaidasPage — linhas e topo do painel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('o topo do painel mostra a contagem e o total do mês', async () => {
    instalarApi([
      ocorrencia({ descricao: 'Mercado', cartaoId: INTER.id, impactoCentavos: 10000 }),
      ocorrencia({ descricao: 'Farmácia', cartaoId: INTER.id, impactoCentavos: 5000 })
    ])
    renderizar()

    await screen.findByRole('row', { name: /Mercado/ })
    const cabecalho = cabecalhoDoPainel()
    expect(within(cabecalho).getByText('2 lançamentos')).toBeTruthy()
    expect(within(cabecalho).getByText(brl(15000))).toBeTruthy()
  })

  it('com filtro de tipo, o topo diz quantos de quantos', async () => {
    const usuario = userEvent.setup()
    instalarApi([
      ocorrencia({ descricao: 'Mercado', cartaoId: INTER.id, impactoCentavos: 10000 }),
      ocorrencia({
        descricao: 'LATAM',
        tipo: 'Parcelada',
        rotuloParcela: '1/3',
        origemCentavos: 78957,
        impactoCentavos: 26319,
        cartaoId: INTER.id
      })
    ])
    renderizar()
    await screen.findByRole('row', { name: /LATAM/ })

    await usuario.click(screen.getByRole('radio', { name: /^Parceladas/ }))

    const cabecalho = cabecalhoDoPainel()
    expect(within(cabecalho).getByText('1 de 2 lançamentos')).toBeTruthy()
    expect(within(cabecalho).getByText(brl(26319))).toBeTruthy()
  })

  // "de R$ 979,92 R$ 122,49" se lia como uma coisa só, e a coluna de valor
  // tinha dois números em umas linhas e um nas outras.
  it('a coluna Parcela traz o valor de origem, e Neste mês fica com um número só', async () => {
    instalarApi([
      ocorrencia({
        descricao: 'Amazon GPU',
        tipo: 'Parcelada',
        rotuloParcela: '1/8',
        origemCentavos: 97992,
        impactoCentavos: 12249,
        cartaoId: INTER.id
      })
    ])
    renderizar()

    const linha = await screen.findByRole('row', { name: /Amazon GPU/ })
    // Descrição, Categoria, Compra, Parcela, Neste mês e ações.
    const celulas = within(linha).getAllByRole('cell')
    expect(celulas[3]?.textContent).toBe(`1/8 de ${formatBRL(97992)}`)
    expect(celulas[4]?.textContent).toBe(formatBRL(12249))
  })

  // "à vista" é o caso comum: em tom de apoio, parcela e mensalidade sobressaem.
  it('marca "à vista" como tom de apoio, e não a parcela', async () => {
    instalarApi([
      ocorrencia({ descricao: 'Castelão', cartaoId: INTER.id }),
      ocorrencia({
        descricao: 'LATAM',
        tipo: 'Parcelada',
        rotuloParcela: '1/3',
        cartaoId: INTER.id
      })
    ])
    renderizar()

    const avista = await screen.findByRole('row', { name: /Castelão/ })
    const parcelada = screen.getByRole('row', { name: /LATAM/ })
    expect(within(avista).getByText('à vista').dataset.tom).toBe('apoio')
    expect(within(parcelada).getByText('1/3').dataset.tom).toBeUndefined()
  })

  it('a coluna Categoria mostra a bolinha com a cor da categoria', async () => {
    instalarApi([ocorrencia({ descricao: 'Hotel', categoriaId: MORADIA.id, cartaoId: INTER.id })])
    renderizar()

    const linha = await screen.findByRole('row', { name: /Hotel/ })
    await waitFor(() => expect(within(linha).getByText('Moradia')).toBeTruthy())
    const categoria = within(linha).getAllByRole('cell')[1]
    const bolinha = categoria?.querySelector<HTMLElement>('[data-bolinha]')
    expect(bolinha?.style.background).toBe('rgb(91, 122, 94)')
  })
})
