// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StatusFatura } from '@domain/entities/fatura'
import type { FaturaComTotal } from '@shared/ipc/fatura'
import { HistoricoFaturas } from '../HistoricoFaturas'

let proximoId = 1

function fatura(mesReferencia: string, status: StatusFatura): FaturaComTotal {
  return {
    fatura: {
      id: proximoId++,
      cartaoId: 1,
      mesReferencia,
      dataFechamento: `${mesReferencia}-05`,
      dataVencimento: `${mesReferencia}-12`,
      status,
      createdAt: '',
      updatedAt: ''
    },
    mesReferencia,
    totalCentavos: 10000,
    pagoParcialCentavos: 0,
    restanteCentavos: 10000
  }
}

// Hoje é 29/09/2026: agosto venceu em 12/08, junho e julho foram pagos.
const FATURAS = [
  fatura('2026-06', { kind: 'Paga', pagaEm: '2026-06-10' }),
  fatura('2026-07', { kind: 'Paga', pagaEm: '2026-07-11' }),
  fatura('2026-08', { kind: 'Fechada' }),
  fatura('2026-09', { kind: 'Aberta' })
]

function renderizar() {
  render(
    <HistoricoFaturas
      faturas={FATURAS}
      mesAtual="2026-09"
      faturaAbertaId={FATURAS[3]!.fatura.id}
      cartaoCor="#f70"
      onAbrir={() => {}}
    />
  )
}

function abas() {
  return screen.getByRole('radiogroup', { name: 'Filtrar faturas por status' })
}

describe('HistoricoFaturas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // "Abertas" quase nunca tinha item, e as três abas de status não diziam
  // quantas havia em cada uma: para saber se algo ficou sem pagar era preciso
  // clicar. "A pagar" e "Pagas" somam "Todas".
  it('as abas são Todas, A pagar e Pagas, cada uma com a contagem', () => {
    renderizar()

    const nomes = within(abas())
      .getAllByRole('radio')
      .map((r) => r.textContent)
    expect(nomes).toEqual(['Todas 3', 'A pagar 1', 'Pagas 2'])
  })

  // A meta do painel era um "3" sem rótulo, repetindo a linha de baixo
  // ("Mostrar 3 faturas de meses anteriores").
  it('não repete a contagem solta no cabeçalho', () => {
    renderizar()

    expect(screen.queryByText('3', { exact: true })).toBeNull()
  })

  it('escolher uma aba abre a lista', async () => {
    renderizar()
    const usuario = userEvent.setup()
    const expandir = screen.getByRole('button', { name: /meses anteriores/ })
    expect(expandir.getAttribute('aria-expanded')).toBe('false')

    await usuario.click(within(abas()).getByRole('radio', { name: /^A pagar/ }))

    expect(expandir.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Agosto de 2026')).toBeTruthy()
    expect(screen.queryByText('Julho de 2026')).toBeNull()
  })

  it('a linha paga diz quando foi paga, no lugar do vencimento', async () => {
    renderizar()
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: /meses anteriores/ }))

    const julho = screen.getByRole('button', { name: /Julho de 2026/ })
    expect(within(julho).getByText(/Paga em 11\/07\/2026/)).toBeTruthy()
    expect(within(julho).queryByText(/Vence/)).toBeNull()
  })

  it('a linha não paga e vencida avisa, em tom de alerta', async () => {
    renderizar()
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: /meses anteriores/ }))

    const agosto = screen.getByRole('button', { name: /Agosto de 2026/ })
    const aviso = within(agosto).getByText('vencida há 48 dias')
    expect(aviso.getAttribute('data-tom')).toBe('alerta')
  })
})
