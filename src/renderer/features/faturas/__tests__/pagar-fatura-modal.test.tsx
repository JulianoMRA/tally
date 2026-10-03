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
      pagoParcialCentavos={0}
      restanteCentavos={183881}
      loading={false}
      erro={null}
      onConfirmar={onConfirmar}
      onCancelar={vi.fn()}
      {...over}
    />
  )
  return onConfirmar
}

function dataDoPagamento(): HTMLInputElement {
  return screen.getByLabelText('Data do pagamento') as HTMLInputElement
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
    expect(dataDoPagamento().value).toBe('2026-09-29')
  })

  it('confirma com a data escolhida', async () => {
    const onConfirmar = renderizar()
    const usuario = userEvent.setup()

    fireEvent.change(dataDoPagamento(), { target: { value: '2026-09-27' } })
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))

    expect(onConfirmar).toHaveBeenCalledWith('2026-09-27')
  })

  it('sem data, não deixa confirmar', () => {
    renderizar()

    fireEvent.change(dataDoPagamento(), { target: { value: '' } })

    const confirmar = screen.getByRole('button', { name: 'Confirmar pagamento' })
    expect((confirmar as HTMLButtonElement).disabled).toBe(true)
  })

  // RF-FAT-04 — só o botão desabilitado não dizia o que estava errado. O
  // diálogo de pagamento parcial já dizia, e os dois agora falam igual.
  it('com a data apagada, diz que ela é inválida', () => {
    renderizar()
    expect(screen.queryByText('Data inválida.')).toBeNull()

    fireEvent.change(dataDoPagamento(), { target: { value: '' } })

    expect(screen.getByText('Data inválida.')).toBeTruthy()
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

  /**
   * RN-10 — com pagamento parcial, o que se paga aqui é o restante. O diálogo
   * dizia só o total, e confirmar parecia pagar de novo o que já tinha sido
   * pago.
   */
  describe('com pagamento parcial', () => {
    it('diz o que falta, de quanto, e o que já foi pago', () => {
      renderizar({ totalCentavos: 80000, pagoParcialCentavos: 20000, restanteCentavos: 60000 })

      const texto = screen.getByRole('dialog').textContent ?? ''
      expect(texto).toMatch(/falta pagar R\$\s*600,00 de R\$\s*800,00/)
      expect(texto).toMatch(/R\$\s*200,00 já pagos/)
    })

    it('sem parcial, segue dizendo só o total', () => {
      renderizar()

      const texto = screen.getByRole('dialog').textContent ?? ''
      expect(texto).toMatch(/R\$\s*1\.838,81/)
      expect(texto).not.toMatch(/falta pagar/)
      expect(texto).not.toMatch(/já pagos/)
    })
  })
})
