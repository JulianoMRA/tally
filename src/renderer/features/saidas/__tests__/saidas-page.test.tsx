// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { ToastProvider } from '../../../components/ui'
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
