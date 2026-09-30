// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PagarFaturaModal } from '../PagarFaturaModal'

function renderizar(over: Partial<Parameters<typeof PagarFaturaModal>[0]> = {}) {
  const onConfirmar = vi.fn()
  render(
    <PagarFaturaModal
      cartaoNome="Inter"
      mesReferencia="2026-09"
      totalCentavos={183881}
      loading={false}
      erro={null}
      onConfirmar={onConfirmar}
      onCancelar={vi.fn()}
      {...over}
    />
  )
  return onConfirmar
}

function dataDePagamento(): HTMLInputElement {
  return screen.getByLabelText('Data de pagamento') as HTMLInputElement
}

/**
 * RF-FAT-04 — marcar como paga pede confirmação, e a data é a única coisa a
 * decidir. Era um formulário inline no card de resumo, o único passo do ciclo
 * fora de um diálogo; com a data apagada, "Confirmar pagamento" mandava uma
 * string vazia ao main e o card mostrava o JSON do zod.
 */
describe('PagarFaturaModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('diz qual fatura está sendo paga, e a data começa em hoje', () => {
    renderizar()

    expect(screen.getByRole('dialog', { name: 'Marcar fatura como paga' })).toBeTruthy()
    expect(screen.getByText(/Inter · Setembro de 2026/)).toBeTruthy()
    expect(dataDePagamento().value).toBe('2026-09-29')
  })

  it('confirma com a data escolhida', async () => {
    const onConfirmar = renderizar()
    const usuario = userEvent.setup()

    fireEvent.change(dataDePagamento(), { target: { value: '2026-09-27' } })
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    expect(onConfirmar).toHaveBeenCalledWith('2026-09-27')
  })

  it('sem data, não deixa confirmar', () => {
    renderizar()

    fireEvent.change(dataDePagamento(), { target: { value: '' } })

    const confirmar = screen.getByRole('button', { name: 'Confirmar pagamento' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
  })

  it('mostra o erro dentro do diálogo', () => {
    renderizar({ erro: 'Fatura já está paga.' })

    expect(screen.getByRole('dialog').textContent).toContain('Fatura já está paga.')
  })

  it('enquanto paga, não deixa confirmar de novo', () => {
    renderizar({ loading: true })

    const confirmar = screen.getByRole('button', { name: /Confirm|Pagando/ })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
  })
})
