// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '../../../components/ui'
import CartoesPage from '../CartoesPage'

type ApiMock = {
  cartao: {
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  fatura: {
    listarResumoPorCartao: ReturnType<typeof vi.fn>
  }
}

function instalarApiMock(): ApiMock {
  const api: ApiMock = {
    cartao: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn()
    },
    // A linha do cartão passou a mostrar fatura aberta e série de 6 meses.
    fatura: {
      listarResumoPorCartao: vi.fn().mockResolvedValue([])
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

// O formulário saiu do layout permanente e virou SidePanel (ponto 16): abrir o
// painel passou a fazer parte do fluxo de cadastro.
async function preencherESalvar(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '+ Novo cartão' }))
  await user.type(screen.getByLabelText(/Nome/), 'Inter')
  await user.type(screen.getByLabelText(/Dia de fechamento/), '5')
  await user.type(screen.getByLabelText(/Dia de vencimento/), '12')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
}

describe('CartoesPage — feedback de erro nas mutações', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('mostra toast de erro com a mensagem do IPC quando criar cartão falha', async () => {
    const api = instalarApiMock()
    api.cartao.create.mockRejectedValue(
      new Error("Error invoking remote method 'cartao:create': Error: Cartão duplicado")
    )

    render(
      <ToastProvider>
        <CartoesPage />
      </ToastProvider>
    )
    await preencherESalvar()

    expect(await screen.findByText('Cartão duplicado')).toBeTruthy()
  })

  it('mostra toast de sucesso quando criar cartão funciona', async () => {
    const api = instalarApiMock()
    api.cartao.create.mockResolvedValue({ id: 1 })

    render(
      <ToastProvider>
        <CartoesPage />
      </ToastProvider>
    )
    await preencherESalvar()

    expect(await screen.findByText('Cartão criado.')).toBeTruthy()
    expect(api.cartao.create).toHaveBeenCalledOnce()
  })
})
