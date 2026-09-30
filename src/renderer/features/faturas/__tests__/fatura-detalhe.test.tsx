// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Despesa } from '@domain/entities/despesa'
import type { StatusFatura } from '@domain/entities/fatura'
import type { Parcela } from '@domain/entities/parcela'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import { ToastProvider } from '../../../components/ui'
import { FaturaDetalhe } from '../FaturaDetalhe'

function detalhe(status: StatusFatura, dataVencimento = '2026-10-01'): FaturaDetalhada {
  return {
    fatura: {
      id: 10,
      cartaoId: 1,
      mesReferencia: '2026-09',
      dataFechamento: '2026-09-24',
      dataVencimento,
      status,
      createdAt: '',
      updatedAt: ''
    },
    parcelas: [],
    totalCentavos: 183881
  }
}

function renderizar(d: FaturaDetalhada) {
  vi.stubGlobal(
    'window',
    Object.assign(window, { api: { categoria: { list: vi.fn().mockResolvedValue([]) } } })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe
        detalhe={d}
        cartaoNome="Inter"
        cartaoCor="#f70"
        onFaturaAtualizada={() => {}}
        onDetalheAtualizado={() => {}}
      />
    </ToastProvider>
  )
}

/** Hoje fixo em 29/09/2026; só o `Date` é falso. */
describe('FaturaDetalhe — prazo e pagamento no resumo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('fatura Fechada perto do vencimento avisa, em tom de atenção', () => {
    renderizar(detalhe({ kind: 'Fechada' }))

    expect(screen.getByText('vence em 2 dias').getAttribute('data-tom')).toBe('atencao')
  })

  it('fatura vencida avisa em tom de alerta', () => {
    renderizar(detalhe({ kind: 'Fechada' }, '2026-09-10'))

    expect(screen.getByText('vencida há 19 dias').getAttribute('data-tom')).toBe('alerta')
  })

  // O `pagaEm` era gravado e não aparecia em lugar nenhum: a fatura paga não
  // dizia quando foi paga.
  it('fatura paga diz quando foi paga', () => {
    renderizar(detalhe({ kind: 'Paga', pagaEm: '2026-09-20' }))

    expect(screen.getByText('Paga em 20/09/2026')).toBeTruthy()
  })
})

function despesa(over: Partial<Despesa> = {}): Despesa {
  return {
    id: 5,
    descricao: 'Notebook',
    categoriaId: 1,
    tipo: 'Parcelada',
    formaPagamento: 'Credito',
    cartaoId: 1,
    valorCentavos: 300000,
    totalParcelas: 3,
    dataCompra: '2026-08-20',
    diaCobranca: null,
    recorreAte: null,
    nota: null,
    ativa: true,
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

function parcela(over: Partial<Parcela> = {}): Parcela {
  return {
    id: 50,
    despesaId: 5,
    faturaId: 10,
    numero: 2,
    total: 3,
    valorCentavos: 100000,
    dataReferencia: '2026-09-01',
    status: 'Pendente',
    dataPagamento: null,
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

function comParcela(
  status: StatusFatura,
  d: Despesa,
  p: Parcela,
  extra: Partial<FaturaDetalhada> = {}
): FaturaDetalhada {
  return {
    ...detalhe(status),
    parcelas: [p],
    totalCentavos: p.valorCentavos,
    despesasPorParcela: { [p.id]: d },
    ...extra
  }
}

type ApiExtra = Record<string, Record<string, unknown>>

function renderizarCom(d: FaturaDetalhada, api: ApiExtra = {}) {
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { categoria: { list: vi.fn().mockResolvedValue([]) }, ...api }
    })
  )
  render(
    <ToastProvider>
      <FaturaDetalhe
        detalhe={d}
        cartaoNome="Inter"
        cartaoCor="#f70"
        onFaturaAtualizada={() => {}}
        onDetalheAtualizado={() => {}}
      />
    </ToastProvider>
  )
}

async function itemDoMenu(rotulo: string) {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('button', { name: /^Mais ações/ }))
  return within(screen.getByRole('menu')).getByRole('menuitem', { name: rotulo })
}

// RF-DES-09 — a tela oferecia Excluir em toda parcela pendente e só descobria
// o bloqueio depois do diálogo "irreversível".
describe('FaturaDetalhe — Excluir', () => {
  afterEach(cleanup)

  it('fica desabilitado quando a exclusão está bloqueada, com o motivo', async () => {
    renderizarCom(
      comParcela({ kind: 'Aberta' }, despesa(), parcela(), {
        exclusaoBloqueada: { 5: 'has-parcela-em-fatura-fechada' }
      })
    )

    const excluir = await itemDoMenu('Excluir')
    expect((excluir as HTMLButtonElement).disabled).toBe(true)
    expect(excluir.getAttribute('title')).toMatch(/fatura fechada/)
  })

  it('segue habilitado quando nada bloqueia', async () => {
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela(), { exclusaoBloqueada: {} }))

    const excluir = await itemDoMenu('Excluir')
    expect((excluir as HTMLButtonElement).disabled).toBe(false)
  })
})

// RF-DES-10 — numa fatura Fechada, a compra à vista não aceita valor nem data
// novos; o modal deixava editar e a gravação era recusada.
describe('FaturaDetalhe — editar compra à vista em fatura fechada', () => {
  afterEach(cleanup)

  it('abre o modal com valor e data travados', async () => {
    const aVista = despesa({ tipo: 'Unica', totalParcelas: 1, valorCentavos: 5000 })
    renderizarCom(comParcela({ kind: 'Fechada' }, aVista, parcela({ numero: 1, total: 1 })))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))

    const modal = screen.getByRole('dialog', { name: 'Editar despesa' })
    expect((within(modal).getByLabelText('Valor (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((within(modal).getByLabelText('Data da compra') as HTMLInputElement).disabled).toBe(true)
  })

  it('numa fatura Aberta, valor e data seguem editáveis', async () => {
    const aVista = despesa({ tipo: 'Unica', totalParcelas: 1, valorCentavos: 5000 })
    renderizarCom(comParcela({ kind: 'Aberta' }, aVista, parcela({ numero: 1, total: 1 })))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))

    const modal = screen.getByRole('dialog', { name: 'Editar despesa' })
    expect((within(modal).getByLabelText('Valor (R$)') as HTMLInputElement).disabled).toBe(false)
  })
})

describe('FaturaDetalhe — ciclo da fatura', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // RF-FAT-04 — era um formulário inline, o único passo do ciclo fora de um
  // diálogo. O erro fica no diálogo, legível, e ele só fecha quando dá certo.
  it('marcar como paga abre um diálogo; o erro fica nele, sem o prefixo do Electron', async () => {
    const pagar = vi
      .fn()
      .mockRejectedValue(
        new Error("Error invoking remote method 'fatura:pagar': Error: Fatura já está paga.")
      )
    renderizarCom(detalhe({ kind: 'Fechada' }), { fatura: { pagar } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    const dialogo = screen.getByRole('dialog', { name: 'Marcar fatura como paga' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pagamento' }))

    expect(pagar).toHaveBeenCalledWith(10, '2026-09-29')
    expect(await within(dialogo).findByText('Fatura já está paga.')).toBeTruthy()
    expect(screen.queryByText(/Error invoking/)).toBeNull()
  })

  it('pago com sucesso, o diálogo fecha', async () => {
    const pagar = vi.fn().mockResolvedValue({
      ...detalhe({ kind: 'Fechada' }).fatura,
      status: { kind: 'Paga', pagaEm: '2026-09-29' }
    })
    renderizarCom(detalhe({ kind: 'Fechada' }), { fatura: { pagar } })
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Marcar fatura como paga' })).toBeNull()
    )
  })

  // O texto dizia que "novas parcelas só entram via adiantamento" — mas fatura
  // Fechada recusa justamente o adiantamento (RN-06).
  it('o diálogo de fechar diz o que o fechamento trava', async () => {
    renderizarCom(detalhe({ kind: 'Aberta' }))
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('button', { name: 'Fechar fatura' }))

    const texto = screen.getByRole('dialog', { name: 'Fechar fatura?' }).textContent ?? ''
    expect(texto).not.toMatch(/só entram via adiantamento/)
    expect(texto).toMatch(/não recebe mais adiantamentos/)
  })
})

// RN-03 — o aviso repetia a quantidade pedida, mesmo quando o main movia menos.
describe('FaturaDetalhe — aviso do adiantamento', () => {
  afterEach(cleanup)

  async function adiantar(movidas: number, quantidade: string) {
    const adiantarParcelas = vi.fn().mockResolvedValue({
      movidas: Array.from({ length: movidas }, (_, i) => ({ id: i })),
      faturasAfetadas: []
    })
    renderizarCom(comParcela({ kind: 'Aberta' }, despesa(), parcela()), {
      despesa: { adiantarParcelas },
      fatura: {
        listarPorCartao: vi.fn().mockResolvedValue([detalhe({ kind: 'Aberta' }).fatura]),
        detalharComParcelas: vi.fn().mockResolvedValue(null)
      }
    })
    const usuario = userEvent.setup()
    await usuario.click(await itemDoMenu('Adiantar'))
    const modal = screen.getByRole('dialog', { name: 'Adiantar parcelas' })
    await vi.waitFor(() =>
      expect((within(modal).getByLabelText('Fatura destino') as HTMLSelectElement).disabled).toBe(
        false
      )
    )
    const campo = within(modal).getByLabelText('Quantidade de parcelas')
    await usuario.clear(campo)
    await usuario.type(campo, quantidade)
    await usuario.click(within(modal).getByRole('button', { name: 'Confirmar' }))
  }

  it('conta as parcelas que o main moveu, não as pedidas', async () => {
    await adiantar(2, '3')

    expect(await screen.findByText('2 de 3 parcelas adiantadas.')).toBeTruthy()
  })

  it('sem nada movido, diz que não havia o que adiantar', async () => {
    await adiantar(0, '1')

    expect(await screen.findByText('Nenhuma parcela para adiantar para esta fatura.')).toBeTruthy()
  })
})
