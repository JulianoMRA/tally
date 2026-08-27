// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { AvulsoPanel } from '../AvulsoPanel'

const EXISTENTE: RecebimentoComContexto = {
  id: 7,
  rendaId: null,
  descricao: 'Freela de design',
  nome: 'Freela de design',
  valorCentavos: 150_000,
  dataEsperada: '2026-08-10',
  dataRecebida: '2026-08-12',
  status: 'Recebido',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

describe('AvulsoPanel', () => {
  afterEach(cleanup)

  it('não pede fonte de renda — só descrição, valor e datas', () => {
    render(<AvulsoPanel onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

    // O seletor de fonte era o campo que obrigava a escolher (ou criar) uma
    // renda antes de registrar a entrada. Fonte de renda passou a existir só
    // para entrada constante.
    expect(screen.queryByLabelText('Fonte')).toBeNull()

    expect(screen.getByLabelText('Descrição')).toBeTruthy()
    expect(screen.getByLabelText('Valor (R$)')).toBeTruthy()
    expect(screen.getByLabelText('Data esperada')).toBeTruthy()
  })

  it('entrega os quatro campos, sem qualquer referência a renda', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn().mockResolvedValue(undefined)
    render(<AvulsoPanel onConfirmar={onConfirmar} onCancelar={vi.fn()} />)

    await user.type(screen.getByLabelText('Descrição'), 'Venda da bicicleta')
    await user.type(screen.getByLabelText('Valor (R$)'), '450,00')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    const enviado = onConfirmar.mock.calls[0][0]
    expect(enviado).toMatchObject({ descricao: 'Venda da bicicleta', valorCentavos: 45_000 })
    expect(enviado).not.toHaveProperty('rendaId')
    expect(enviado).not.toHaveProperty('nome')
  })

  it('exige descrição: sem ela não chama o callback', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn()
    render(<AvulsoPanel onConfirmar={onConfirmar} onCancelar={vi.fn()} />)

    await user.type(screen.getByLabelText('Valor (R$)'), '100,00')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.getByText('Descrição é obrigatória.')).toBeTruthy()
  })

  it('recusa valor mal formado antes de chamar o callback', async () => {
    const user = userEvent.setup()
    const onConfirmar = vi.fn()
    render(<AvulsoPanel onConfirmar={onConfirmar} onCancelar={vi.fn()} />)

    await user.type(screen.getByLabelText('Descrição'), 'X')
    await user.type(screen.getByLabelText('Valor (R$)'), '1.234,56')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.getByText('Valor inválido.')).toBeTruthy()
  })

  describe('modo edição', () => {
    it('preenche os campos com a entrada existente', () => {
      render(<AvulsoPanel inicial={EXISTENTE} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe(
        'Freela de design'
      )
      expect((screen.getByLabelText('Valor (R$)') as HTMLInputElement).value).toBe('1500,00')
      expect((screen.getByLabelText('Data esperada') as HTMLInputElement).value).toBe('2026-08-10')
      expect((screen.getByLabelText('Data recebida') as HTMLInputElement).value).toBe('2026-08-12')
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
    })

    it('desmarcar "Já recebi" tira a data de recebimento do envio', async () => {
      const user = userEvent.setup()
      const onConfirmar = vi.fn().mockResolvedValue(undefined)
      render(<AvulsoPanel inicial={EXISTENTE} onConfirmar={onConfirmar} onCancelar={vi.fn()} />)

      await user.click(screen.getByLabelText('Já recebi'))
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(onConfirmar.mock.calls[0][0].dataRecebida).toBeUndefined()
    })
  })
})
