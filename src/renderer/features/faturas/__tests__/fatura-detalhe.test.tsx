// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { StatusFatura } from '@domain/entities/fatura'
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
