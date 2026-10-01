// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegistrarPagamentoParcialModal } from '../RegistrarPagamentoParcialModal'

type Props = Parameters<typeof RegistrarPagamentoParcialModal>[0]

/** Fatura Aberta do Inter, setembro/2026, faltando R$ 600,00. */
function renderizar(over: Partial<Props> = {}) {
  const onConfirmar = vi.fn().mockResolvedValue(undefined)
  render(
    <RegistrarPagamentoParcialModal
      cartaoNome="Inter"
      mesReferencia="2026-09"
      statusFatura="Aberta"
      restanteCentavos={60000}
      onConfirmar={onConfirmar}
      onCancelar={vi.fn()}
      {...over}
    />
  )
  return onConfirmar
}

function valor(): HTMLInputElement {
  return screen.getByLabelText('Valor (R$)') as HTMLInputElement
}

function data(): HTMLInputElement {
  return screen.getByLabelText('Data do pagamento') as HTMLInputElement
}

function registrar(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: /Registrar pagamento|Registrando/
  }) as HTMLButtonElement
}

async function digitarValor(texto: string) {
  const usuario = userEvent.setup({ delay: null })
  await usuario.type(valor(), texto)
  return usuario
}

/**
 * RF-FAT-07 — registrar pagamento parcial.
 *
 * O diálogo confere com a MESMA regra do main (`podeRegistrarPagamentoParcial`)
 * antes de habilitar o botão: uma ação que a tela sabe que vai falhar não deve
 * ser oferecida para falhar depois do clique.
 */
describe('RegistrarPagamentoParcialModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('diz de qual fatura é e quanto falta; a data começa em hoje', () => {
    renderizar()

    const dialogo = screen.getByRole('dialog', { name: 'Registrar pagamento parcial' })
    expect(dialogo.textContent).toMatch(/Inter · Setembro de 2026/)
    expect(dialogo.textContent).toMatch(/falta pagar R\$\s*600,00/)
    expect(data().value).toBe('2026-09-29')
  })

  it('sem valor, não deixa registrar e não acusa erro nenhum', () => {
    renderizar()

    expect(registrar().disabled).toBe(true)
    expect(screen.queryByText(/inválido|maior que zero|falta pagar nesta/)).toBeNull()
  })

  it('registra o valor em centavos com a data escolhida', async () => {
    const onConfirmar = renderizar()
    const usuario = await digitarValor('200,00')

    fireEvent.change(data(), { target: { value: '2026-09-27' } })
    await usuario.click(registrar())

    expect(onConfirmar).toHaveBeenCalledWith({ valorCentavos: 20000, dataPagamento: '2026-09-27' })
  })

  // A mesma gramática de valor dos outros formulários (`parseCentavos`).
  it('aceita o valor com separador de milhar', async () => {
    const onConfirmar = renderizar({ restanteCentavos: 500000 })
    const usuario = await digitarValor('1.234,56')

    await usuario.click(registrar())

    expect(onConfirmar).toHaveBeenCalledWith({ valorCentavos: 123456, dataPagamento: '2026-09-29' })
  })

  it('valor que não é dinheiro não deixa registrar, e diz por quê', async () => {
    renderizar()
    await digitarValor('abc')

    expect(screen.getByText('Valor inválido.')).toBeTruthy()
    expect(registrar().disabled).toBe(true)
  })

  it('valor zero não deixa registrar', async () => {
    renderizar()
    await digitarValor('0')

    expect(screen.getByText(/maior que zero/)).toBeTruthy()
    expect(registrar().disabled).toBe(true)
  })

  it('valor acima do que falta não deixa registrar', async () => {
    renderizar()
    await digitarValor('600,01')

    expect(screen.getByText(/passa do que falta pagar/)).toBeTruthy()
    expect(registrar().disabled).toBe(true)
  })

  // Fatura Aberta ainda não pode ser marcada como paga: pagar tudo o que há
  // nela até agora é um pagamento parcial como outro qualquer.
  it('em fatura Aberta, aceita o valor igual ao que falta', async () => {
    renderizar({ statusFatura: 'Aberta' })
    await digitarValor('600,00')

    expect(registrar().disabled).toBe(false)
  })

  it('em fatura Fechada, o valor que quita aponta "Marcar como paga"', async () => {
    renderizar({ statusFatura: 'Fechada' })
    await digitarValor('600,00')

    expect(screen.getByText(/Marcar como paga/)).toBeTruthy()
    expect(registrar().disabled).toBe(true)
  })

  it('em fatura Fechada, abaixo do que falta segue liberado', async () => {
    renderizar({ statusFatura: 'Fechada' })
    await digitarValor('599,99')

    expect(registrar().disabled).toBe(false)
  })

  it('sem data, não deixa registrar', async () => {
    renderizar()
    await digitarValor('200,00')

    fireEvent.change(data(), { target: { value: '' } })

    expect(registrar().disabled).toBe(true)
  })

  // O erro fica no diálogo, legível, e ele não fecha: quem fecha é o pai,
  // quando o registro dá certo.
  it('o erro do main fica no diálogo, sem o prefixo do Electron', async () => {
    const onConfirmar = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Error invoking remote method 'fatura:registrarPagamentoParcial': Error: O valor passa do que falta pagar nesta fatura."
        )
      )
    renderizar({ onConfirmar })
    const usuario = await digitarValor('200,00')

    await usuario.click(registrar())

    const dialogo = screen.getByRole('dialog')
    expect(await screen.findByText('O valor passa do que falta pagar nesta fatura.')).toBeTruthy()
    expect(dialogo.textContent).not.toMatch(/Error invoking/)
    expect(registrar().disabled).toBe(false)
  })

  it('enquanto registra, não deixa registrar de novo', async () => {
    const onConfirmar = vi.fn(() => new Promise<void>(() => {}))
    renderizar({ onConfirmar })
    const usuario = await digitarValor('200,00')

    await usuario.click(registrar())

    expect(registrar().disabled).toBe(true)
    expect(registrar().textContent).toBe('Registrando…')
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('Cancelar fecha sem registrar', async () => {
    const onCancelar = vi.fn()
    const onConfirmar = renderizar({ onCancelar })
    const usuario = userEvent.setup({ delay: null })

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })
})
