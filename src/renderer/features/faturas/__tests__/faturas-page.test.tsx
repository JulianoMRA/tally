// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Cartao } from '@domain/entities/cartao'
import type { StatusFatura } from '@domain/entities/fatura'
import type { FaturaComTotal, FaturaDetalhada } from '@shared/ipc/fatura'
import { ToastProvider } from '../../../components/ui'
import { cartao } from '../../../__tests__/__fixtures__/builders'
import FaturasPage from '../FaturasPage'

const INTER = cartao({ id: 1, nome: 'Inter' })
const ANTIGO = cartao({ id: 2, nome: 'Antigo', ativo: false })

function fatura(
  id: number,
  cartaoId: number,
  mesReferencia: string,
  status: StatusFatura,
  totalCentavos = 10000
): FaturaComTotal {
  return {
    fatura: {
      id,
      cartaoId,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status,
      createdAt: '',
      updatedAt: ''
    },
    mesReferencia,
    totalCentavos
  }
}

/**
 * Dublê do `window.api` com o que a tela carrega: os cartões (arquivados
 * inclusive), o resumo das faturas de cada um e o detalhe da fatura em foco.
 */
function instalarApi(cartoes: Cartao[], faturasPorCartao: Record<number, FaturaComTotal[]>) {
  const todas = Object.values(faturasPorCartao).flat()
  const api = {
    // Como o repositório: os arquivados só vêm quando pedidos.
    cartao: {
      list: vi.fn(async (opcoes?: { incluirArquivados?: boolean }) =>
        opcoes?.incluirArquivados ? cartoes : cartoes.filter((c) => c.ativo)
      )
    },
    categoria: { list: vi.fn().mockResolvedValue([]) },
    fatura: {
      listarResumoPorCartao: vi.fn(async (id: number) => faturasPorCartao[id] ?? []),
      detalharComParcelas: vi.fn(async (id: number): Promise<FaturaDetalhada | null> => {
        const alvo = todas.find((f) => f.fatura.id === id)
        return alvo ? { fatura: alvo.fatura, parcelas: [], totalCentavos: 0 } : null
      }),
      // Muta o dublê como o banco faria: a próxima carga já vê a fatura paga.
      pagar: vi.fn(async (id: number, dataPagamento: string) => {
        const alvo = todas.find((f) => f.fatura.id === id)
        if (!alvo) throw new Error(`Fatura #${id} não encontrada`)
        alvo.fatura = { ...alvo.fatura, status: { kind: 'Paga', pagaEm: dataPagamento } }
        return alvo.fatura
      })
    }
  }
  vi.stubGlobal('window', Object.assign(window, { api }))
  return api
}

function renderizar(url = '/faturas') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <FaturasPage />
      </ToastProvider>
    </MemoryRouter>
  )
}

function trilho() {
  return screen.getByRole('group', { name: 'Cartões' })
}

describe('FaturasPage — cartão arquivado (RF-CAR-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('pede os cartões com os arquivados', async () => {
    const api = instalarApi([INTER], { 1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })] })
    renderizar()

    await screen.findByRole('group', { name: 'Cartões' })
    expect(api.cartao.list).toHaveBeenCalledWith({ incluirArquivados: true })
  })

  // Trocar de cartão com uma compra em 12x ainda correndo: as faturas do
  // cartão arquivado seguiam no saldo e na Visão mensal, e não havia onde
  // pagá-las.
  it('mostra o arquivado com fatura a pagar, com o selo, depois dos ativos', async () => {
    instalarApi([ANTIGO, INTER], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Fechada' })]
    })
    renderizar()

    const antigo = await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole(
      'button',
      { name: /^Antigo/ }
    )
    expect(within(antigo).getByText('Arquivado')).toBeTruthy()
    const nomes = within(trilho())
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
    expect(nomes[0]).toMatch(/^Inter/)
    expect(nomes[1]).toMatch(/^Antigo/)
  })

  it('deixa de fora o arquivado com tudo pago', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })]
    })
    renderizar()

    await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole('button', {
      name: /^Inter/
    })
    expect(within(trilho()).queryByRole('button', { name: /^Antigo/ })).toBeNull()
  })

  // O link da Visão mensal aponta para a fatura mesmo depois de paga. A tela
  // caía no primeiro cartão ativo e afirmava que a fatura não existia mais.
  it('o link para fatura de cartão arquivado abre essa fatura, sem aviso falso', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })]
    })
    renderizar('/faturas?cartaoId=2&faturaId=20')

    expect(await screen.findByRole('heading', { name: 'Antigo · Agosto de 2026' })).toBeTruthy()
    expect(within(trilho()).getByRole('button', { name: /^Antigo/ })).toBeTruthy()
    expect(screen.queryByText(/não existe mais/)).toBeNull()
  })
})

describe('FaturasPage — pagar a última fatura de um arquivado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // Sem nada a pagar ele deixaria o trilho — mas não debaixo do painel que o
  // está mostrando, senão a tela pularia para outro cartão logo após o
  // pagamento.
  it('o arquivado em foco continua no trilho depois de pago', async () => {
    instalarApi([INTER, ANTIGO], {
      1: [fatura(10, 1, '2026-09', { kind: 'Aberta' })],
      2: [fatura(20, 2, '2026-08', { kind: 'Fechada' })]
    })
    renderizar()
    const usuario = userEvent.setup()

    const antigo = await within(await screen.findByRole('group', { name: 'Cartões' })).findByRole(
      'button',
      { name: /^Antigo/ }
    )
    await usuario.click(antigo)
    await screen.findByRole('heading', { name: 'Antigo · Agosto de 2026' })

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    expect(await screen.findByRole('button', { name: 'Reabrir fatura' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antigo · Agosto de 2026' })).toBeTruthy()
    expect(within(trilho()).getByRole('button', { name: /^Antigo/ })).toBeTruthy()
  })
})

describe('FaturasPage — estados vazios', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('sem cartão nenhum, diz que não há cartão cadastrado', async () => {
    instalarApi([], {})
    renderizar()

    expect(await screen.findByText('Nenhum cartão cadastrado')).toBeTruthy()
  })

  // "Nenhum cartão cadastrado" com cartões arquivados no banco afirma sobre os
  // dados do usuário algo que não é verdade.
  it('só com arquivados sem nada a pagar, diz que não há cartão ativo', async () => {
    instalarApi([ANTIGO], { 2: [fatura(20, 2, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' })] })
    renderizar()

    expect(await screen.findByText('Nenhum cartão ativo')).toBeTruthy()
    expect(screen.queryByText('Nenhum cartão cadastrado')).toBeNull()
  })
})

// RF-FAT-06 — a navegação anda pelas faturas que existem, e as setas moram
// junto do título, nomeando o destino.
describe('FaturasPage — navegação entre faturas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('a seta leva à próxima fatura que existe, pulando o mês sem fatura', async () => {
    instalarApi([INTER], {
      1: [
        fatura(8, 1, '2026-08', { kind: 'Paga', pagaEm: '2026-08-10' }),
        fatura(9, 1, '2026-09', { kind: 'Fechada' }),
        fatura(11, 1, '2026-11', { kind: 'Aberta' })
      ]
    })
    renderizar()
    const usuario = userEvent.setup()

    await screen.findByRole('heading', { name: 'Inter · Setembro de 2026' })
    expect(screen.getByRole('button', { name: 'Fatura anterior: agosto de 2026' })).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Próxima fatura: novembro de 2026' }))

    expect(await screen.findByRole('heading', { name: 'Inter · Novembro de 2026' })).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Sem próxima fatura' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})
