// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '../../../components/ui'
import { categoria, ocorrencia } from '../../../__tests__/__fixtures__/builders'
import BuscaPage from '../BuscaPage'

const LAZER = categoria({ id: 1, nome: 'Lazer' })
const VIAGEM = categoria({ id: 2, nome: 'Viagem', ativo: false })

function instalarApi() {
  const api = {
    cartao: { list: vi.fn().mockResolvedValue([]) },
    // Como o repositório: as arquivadas só vêm quando pedidas.
    categoria: {
      list: vi.fn(async (opcoes?: { incluirArquivados?: boolean }) =>
        opcoes?.incluirArquivados ? [LAZER, VIAGEM] : [LAZER]
      )
    },
    despesa: {
      listarTags: vi.fn().mockResolvedValue([]),
      buscarOcorrencias: vi.fn().mockResolvedValue([
        ocorrencia({
          descricao: 'Hotel',
          categoriaId: VIAGEM.id,
          cartaoId: null,
          formaPagamento: 'Pix',
          faturaId: null
        })
      ])
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderizar() {
  render(
    <ToastProvider>
      <BuscaPage />
    </ToastProvider>
  )
}

describe('BuscaPage — categoria arquivada (RF-CAT-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  // Buscar é olhar para trás, e o que se procura pode estar numa categoria
  // que já foi arquivada. Antes ela nem aparecia no filtro.
  it('oferece as categorias arquivadas no fim do filtro, marcadas', async () => {
    instalarApi()
    renderizar()

    const select = screen.getByLabelText('Categoria') as HTMLSelectElement
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toEqual([
        'Todas as categorias',
        'Lazer',
        'Viagem (arquivada)'
      ])
    )
  })

  it('mostra o nome da categoria arquivada no resultado, com o selo', async () => {
    instalarApi()
    renderizar()
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))

    const linha = await screen.findByRole('row', { name: /Hotel/ })
    await waitFor(() => expect(within(linha).getByText('Viagem')).toBeTruthy())
    expect(within(linha).getByText('Arquivada')).toBeTruthy()
  })
})
